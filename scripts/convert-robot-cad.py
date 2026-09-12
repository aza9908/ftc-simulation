"""Offline STEP → optimized GLB. Requires cadquery-ocp, trimesh, numpy,
fast-simplification. Source archives and license links: public/models/CREDITS.md.
Usage: python scripts/convert-robot-cad.py INPUT OUTPUT [X_ROT_DEG] [Y_ROT_DEG] [TRI_BUDGET] [MIN_DETAIL_MM]
"""
import sys,json,time,math,os
print("Conversion PID",os.getpid(),flush=True)
import numpy as np
import trimesh
from OCP.XCAFApp import XCAFApp_Application
from OCP.BinXCAFDrivers import BinXCAFDrivers
from OCP.Interface import Interface_Static
from OCP.Resource import Resource_DataMapOfAsciiStringAsciiString
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.XCAFDoc import XCAFDoc_DocumentTool, XCAFDoc_ColorSurf, XCAFDoc_ColorGen
from OCP.TDocStd import TDocStd_Document
from OCP.TCollection import TCollection_ExtendedString, TCollection_AsciiString
from OCP.TDF import TDF_LabelSequence,TDF_Label,TDF_Tool
from OCP.TDataStd import TDataStd_Name
from OCP.TopLoc import TopLoc_Location
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BRep import BRep_Tool
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
from OCP.TopoDS import TopoDS
from OCP.Quantity import Quantity_Color,Quantity_TOC_sRGB
from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
print('Reading CAD',sys.argv[1],flush=True)
app=XCAFApp_Application.GetApplication_s();BinXCAFDrivers.DefineFormat_s(app)
doc=TDocStd_Document(TCollection_ExtendedString('BinXCAF'))
reader=STEPCAFControl_Reader();reader.SetColorMode(True);reader.SetNameMode(True)
# Rendering needs the supplied surfaces, not expensive manufacturing healing.
Interface_Static.SetCVal_s('FromSTEP.exec.op', '')
parameters=Resource_DataMapOfAsciiStringAsciiString()
parameters.Bind(TCollection_AsciiString('FromSTEP.exec.op'),TCollection_AsciiString(''))
parameters.Bind(TCollection_AsciiString('FixShape.FixSameParameterMode'),TCollection_AsciiString('0'))
reader.ChangeReader().SetShapeFixParameters(parameters)
cache_file=sys.argv[1]+'.xbf'
if os.path.exists(cache_file):
 print('Opening cached assembly',flush=True)
 doc=app.Retrieve(TCollection_ExtendedString(os.path.dirname(os.path.abspath(cache_file))),TCollection_ExtendedString(os.path.basename(cache_file)))
else:
 reader.ReadFile(sys.argv[1]);print('Transferring assembly',flush=True);
 if not reader.Transfer(doc):raise RuntimeError('STEP assembly transfer failed')
 print('Caching assembly',flush=True)
 app.SaveAs(doc,TCollection_ExtendedString(cache_file))
st=XCAFDoc_DocumentTool.ShapeTool_s(doc.Main());ct=XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
roots=TDF_LabelSequence();st.GetFreeShapes(roots)
cache={};groups={};parts=[]
budget=int(sys.argv[5]) if len(sys.argv)>5 else 165000
minimum_detail=float(sys.argv[6]) if len(sys.argv)>6 else 6
def name(l):
 n=TDataStd_Name()
 return n.Get().ToExtString() if l.FindAttribute(TDataStd_Name.GetID_s(),n) else 'Part'
def get_color(l,default=(0.52,0.55,0.58)):
 c=Quantity_Color()
 for typ in (XCAFDoc_ColorSurf,XCAFDoc_ColorGen):
  found=ct.GetColor_s(l,typ,c) if isinstance(l,TDF_Label) else ct.GetColor(l,typ,c)
  if found:return tuple(round(v,3) for v in c.Values(Quantity_TOC_sRGB))
 return default
def local_mesh(l):
 entry=TCollection_AsciiString();TDF_Tool.Entry_s(l,entry);key=entry.ToCString()
 if key in cache:return cache[key]
 shape=st.GetShape_s(l)
 if shape.IsNull():cache[key]=[];return []
 box=Bnd_Box();BRepBndLib.Add_s(shape,box)
 if box.IsVoid():cache[key]=[];return []
 bounds=box.Get();size=np.array(bounds[3:])-np.array(bounds[:3])
 # Tiny fasteners have no visible silhouette at playing scale.
 dims=np.sort(size)
 if dims[2] < minimum_detail or (minimum_detail>=18 and dims[1]<9 and dims[2]<80):
  cache[key]=[];return []
 BRepMesh_IncrementalMesh(shape,0.65,False,0.55,True)
 default=get_color(l)
 out={};ex=TopExp_Explorer(shape,TopAbs_FACE)
 while ex.More():
  face=TopoDS.Face_s(ex.Current());loc=TopLoc_Location();tri=BRep_Tool.Triangulation_s(face,loc)
  if tri is not None and tri.NbTriangles() > 0:
   tr=loc.Transformation()
   vv=np.array([tri.Node(i).Transformed(tr).Coord() for i in range(1,tri.NbNodes()+1)])
   ff=np.array([tri.Triangle(i).Get() for i in range(1,tri.NbTriangles()+1)],dtype=np.int32)-1
   if face.Orientation()==TopAbs_REVERSED:ff=ff[:,[0,2,1]]
   color=get_color(face,default)
   out.setdefault(color,[]).append(trimesh.Trimesh(vv,ff,process=False))
  ex.Next()
 result=[(c,trimesh.util.concatenate(ms)) for c,ms in out.items()]
 for _,m in result:m.merge_vertices()
 cache[key]=result
 if len(cache)%50==0:print('Tessellated',len(cache),'unique parts',flush=True)
 return result
def walk(l,parent=TopLoc_Location(),path=''):
 loc=parent.Multiplied(st.GetLocation_s(l));actual=l
 if st.IsReference_s(l):
  actual=TDF_Label();st.GetReferredShape_s(l,actual)
 children=TDF_LabelSequence();st.GetComponents_s(actual,children)
 path=path+'/'+name(actual)
 if "artifact" in path.lower() or "am-3376" in path.lower():return
 if children.Length():
  for i in range(1,children.Length()+1):walk(children.Value(i),loc,path)
  return
 tr=loc.Transformation();matrix=np.eye(4)
 for i in range(3):
  for j in range(4):matrix[i,j]=tr.Value(i+1,j+1)
 for color,m in local_mesh(actual):
  mesh=m.copy();mesh.apply_transform(matrix)
  groups.setdefault(color,[]).append(mesh)
 parts.append(path)
for i in range(1,roots.Length()+1):walk(roots.Value(i))
print('Merging',len(parts),'components',len(groups),'materials',flush=True)
merged={c:trimesh.util.concatenate(ms) for c,ms in groups.items()}
total=sum(len(m.faces) for m in merged.values());print('Raw triangles',total,flush=True)
scene=trimesh.Scene()
rotation=trimesh.transformations.rotation_matrix(math.radians(float(sys.argv[3]) if len(sys.argv)>3 else 0),[1,0,0])
rotation=trimesh.transformations.rotation_matrix(math.radians(float(sys.argv[4]) if len(sys.argv)>4 else 0),[0,1,0])@rotation
for i,(color,m) in enumerate(merged.items()):
 if total>budget:
  count=max(12,int(len(m.faces)*budget/total))
  m.merge_vertices(merge_norm=True,merge_tex=True)
  if count<len(m.faces):m=m.simplify_quadric_decimation(face_count=count,aggression=10)
 m.apply_transform(rotation)
 m.apply_scale(0.001)
 rgba=[int(max(0,min(1,v))*255) for v in color]+[255]
 # Preserve CAD colors; reduce perfect black so details remain legible in the arena.
 rgba[:3]=[max(24,v) for v in rgba[:3]]
 m.visual=trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name='CAD-'+str(i),baseColorFactor=rgba,metallicFactor=.35,roughnessFactor=.55,doubleSided=True))
 scene.add_geometry(m,node_name='CAD-'+str(i))
scene.metadata.update({'source':'See CREDITS.md','adaptation':'Tessellation, fastener removal, simplification, material conversion and orientation; no kinematic reconstruction.'})
if not len(scene.geometry):raise RuntimeError('No visible CAD geometry was found')
scene.export(sys.argv[2])
print('Exported',sys.argv[2], 'triangles',sum(len(m.faces) for m in scene.geometry.values()),'bounds',scene.bounds.tolist(),flush=True)
with open(sys.argv[2]+'.parts.json','w') as f:json.dump(parts,f,indent=2)
