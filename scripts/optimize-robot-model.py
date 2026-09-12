"""Final GLB budget and coordinate conversion; requires trimesh and fast-simplification.
Usage: python optimize-robot-model.py INPUT OUTPUT ROT_X_DEG ROT_Y_DEG
"""
import sys, math, numpy as np, trimesh
scene=trimesh.load(sys.argv[1],force='scene')
budget=220000
total=sum(len(m.faces) for m in scene.geometry.values())
for key,mesh in list(scene.geometry.items()):
    material=mesh.visual.material
    target=max(12, int(len(mesh.faces)*budget/total))
    if len(mesh.faces)>target:
        mesh.merge_vertices(digits_vertex=4, merge_norm=True, merge_tex=True)
        mesh.update_faces(mesh.unique_faces())
        mesh.update_faces(mesh.nondegenerate_faces(height=0.00001))
        mesh.remove_unreferenced_vertices()
        mesh=mesh.simplify_quadric_decimation(face_count=target, aggression=10)
        mesh.visual=trimesh.visual.TextureVisuals(material=material)
        scene.geometry[key]=mesh
rotation=trimesh.transformations.rotation_matrix(math.radians(float(sys.argv[3])),[1,0,0])
rotation=trimesh.transformations.rotation_matrix(math.radians(float(sys.argv[4])),[0,1,0])@rotation
scene.apply_transform(rotation)
count=sum(len(m.faces) for m in scene.geometry.values())
assert 10000<count<300000, f'Optimization failed: {count} triangles'
scene.export(sys.argv[2])
print('Optimized',sys.argv[2], count, 'triangles', scene.bounds.tolist(),flush=True)
