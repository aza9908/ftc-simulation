# FTC robot model credits

These are modified render meshes of real, publicly released DECODE CAD designs. The original designers are credited below. The game does not claim to reproduce their measured performance or imply their endorsement.

## Sideswipe V3

Original design: **Adrian Contraș**, 2026.

Source: https://github.com/adisimaimulte1/ftc-cad-archive

STEP release: https://github.com/adisimaimulte1/ftc-cad-archive/releases/tag/sideswipe-v3

License: [FTC Robot CAD Archive License](SIDESWIPE-LICENSE.txt), included in full. Personal, educational, research and non-commercial use. Commercial use requires the original author's permission. These terms apply to the model and reference image even if the surrounding application uses different terms.

The source identifies V3 as the final DECODE competition robot, with a carbon-fiber chassis and coaxial swerve modules. The reference image is the author's `assets/sideswipe_v3/Sideswipe_v3_1.webp`.

## Cicada × Matrix

Original design: **Team Cicada 31678 and Team Matrix 19348**, Tripoli, Libya, 2025.

Source: https://github.com/cicadaroboticsteam-art/FTC-Decode-30-hours-Robot-matrix-cicada-

Team's design announcement: https://www.chiefdelphi.com/t/ftc-31678-decode-build-thread/506213

License: [The Unlicense](CICADA-LICENSE.txt).

This is the teams' 30-hour DECODE CAD concept, not a claim of competition-proven performance. The reference image is supplied with the original CAD archive.

## Modifications for this simulator

STEP surfaces were tessellated, small hardware details and static reference ARTIFACTS omitted, meshes simplified, materials converted, and axes reoriented to create lightweight GLB files. These GLBs can be imported into Blender. Models are scaled to the simulator's robot envelope. The original fixed shooter assemblies remain visible; the game adds its own elevated rotating turret. That added turret is a simulator adaptation, not part of either original design. These are modified educational render models, not manufacturing files.

All designs use the simulator's common drivetrain, chassis collider, mass and intake. The added turret's height sets the ball launch height. Swerve module and wheel mechanisms are visual geometry; individual actuators, original electronics, deformable parts and exact hardware behavior are not simulated.

No endorsement by Adrian Contraș, the source teams, or FIRST is implied. The original authors' identities and credits must be preserved when reusing these assets.

Offline conversion scripts: `scripts/convert-robot-cad.py` and `scripts/optimize-robot-model.py`. Final mesh cleanup welds vertices within 0.1 mm, removes duplicate/degenerate faces and reduces triangle count. Attribution is embedded with `scripts/stamp-robot-model.mjs`. Raw CAD is not bundled. No login, remote model service or Blender installation is required to play.
