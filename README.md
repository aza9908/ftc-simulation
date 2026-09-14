# FTC Field Lab — BIOBUZZ and DECODE

The root route opens **2026–27 BIOBUZZ**. The existing **2025–26 DECODE** simulator, CAD library, and Blender import workflow remain at `/decode`.

## BIOBUZZ driver practice

A playable, unofficial approximation based on the **kickoff V1 manual released September 12, 2026**. Select one or two local players, any of the four alliance robots, and a 2-minute TELEOP practice or untimed session. No autonomous driving has been reintroduced. Official matches include 30 seconds AUTO, an 8-second transition, and 120 seconds TELEOP; this app explicitly practices only the manual period.

- A 3.6576 m square, 36-tile field, center frame with two independent ±30° hives, four perimeter flowers, alliance loading zones, and gardens.
- All 40 pollen and 16 nectar exist at reset. Each robot starts with four pollen; each flower holds four; each garden has four; each raised hive cell holds three nectar; each alliance has five reserve nectar. Pieces are conserved and returned after leaving the field.
- Rapier runs at 120 Hz with gravity, CCD, friction, restitution, drag, traction-limited mecanum drive, finite turret acceleration, flywheel spin-up, moving-platform launch velocity, and recoil. Free balls physically collide with the field, flowers, robots, and moving hive cells.
- A hive tips after eight pollen or three pollen plus three nectar, matching the field guide calibration. Its physical cell rotates with finite speed and damping, spills balls under gravity, and earns 20 points only after reaching the opposite stop. Each tip unlocks one reserve nectar; the last minute unlocks all remaining reserves.
- Intake accepts at most four pieces. Pollen can be removed from the bottom of a flower; trapped nectar cannot. An animated lift places one piece through a flower's top only when close, facing it, moving slowly, and within the final minute (or free practice).
- Projected scoring includes cell contents, flower ownership and bottom nectar, gardens, and partial loading-zone parking. The clock uses wall time independently of render speed. Controls stop at 0:00; physics settles before final scores. The app does not implement referee penalties or ranking points.
- Each player has independent aim and launch settings. Controller slots remain stable when another controller disconnects. Multiplayer is local on one device, not online rooms.

| Action | P1 keyboard | P2 keyboard | Standard PS5 mapping |
| --- | --- | --- | --- |
| Move across field | WASD | Arrow keys | Left stick |
| Rotate chassis | Q / E | Comma / period | Right stick |
| Intake toggle | R | Slash | Square |
| Launch | Space | Enter | R2 |
| Place in flower | F | M | Cross |
| Introduce nectar | N | B | Triangle |
| Turn turret | Z / X | O / P | R1 + right stick |
| Center turret | C | H | R3 |
| Precision drive | Left Shift | Right Shift | L1 |
| Power / elevation | Sliders and ± buttons | P2 panel | D-pad left/right / up/down |
| Pause / resume | On-screen button | On-screen button | Options |

Turret buttons nudge 10° when clicked and turn continuously when held. They also work while paused. Hive assist computes a launch from the current muzzle position and ball type; changing power or elevation keeps turret tracking and gives manual ballistics. Toggle assist off/on to restore the automatic calculation. The golden floor ring identifies the active robots.

### Sources and physical limits

- [Official BIOBUZZ Competition Manual V1](https://ftc-resources.firstinspires.org/ftc/archive/2027/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20V1.htm), especially §§9–11.
- [Official Event Field Setup Guide V1](https://ftc-resources.firstinspires.org/ftc/archive/2027/field/eventfieldguide), especially hive calibration §12.
- [FIRST playing-field resources and official CAD](https://ftc-resources.firstinspires.org/ftc/archive/2027/field).
- [AprilRobotics 36h11 patterns](https://github.com/AprilRobotics/apriltag-imgs/tree/master/tag36h11), IDs 30–45, placed on the underside of each cell.

This is an engineered training approximation, not a calibrated digital twin or FIRST-endorsed product. Field structures are modeled from documented nominal dimensions and figures, not a direct official CAD import. Robot chassis roll/pitch is constrained; wheel rollers are visual, while chassis impulses model the drivetrain. Ball masses (30 g pollen, 50 g nectar), friction, drag, damping and motor constants are estimates. Balls use spherical colliders. Hive load uses the official calibration combinations to trigger a damped kinematic tipping model, not a fully measured pivot/ballast assembly. Intake attachment and lift actuation are simplified mechanisms. No vision pipeline or robot autonomous programming is included. The four BIOBUZZ robots are training designs; the earlier DECODE CAD designs remain in the DECODE season.

### Validation

`npm test` runs both season suites and checks real Rapier ball capture, calibration, hive spillage, actual assisted projectiles from the default spawn, nectar release, intake capacity, physical flower placement, time gates, player independence and stable gamepad slots. Browser checks cover the visible field and controls. Physical gamepad hardware has not been tested.

---

# DECODE manual simulator

Unofficial FIRST Tech Challenge 2025–26 DECODE manual driving practice. Autonomous play, AI robot routines and the AUTO/transition phases have been removed. Choose a two-minute manual session or untimed manual practice; all driver controls are available immediately after Start driving.

## Robots and players

Choose **Single player** or **Multiplayer · local** above the field. Player 1 can select Blue 1, Blue 2, Red 1 or Red 2. In multiplayer, Player 2 selects a different robot; cooperative same-alliance play and opposing-alliance play both work. Robot colors, labels, spawn positions, goal targeting, gate, loading tray and driver telemetry follow the selection. Changing robot, mode or session length resets the field.

All four robots remain visible. Unselected robots have no driving, shooting or intake routine and remain parked unless moved by contact. Only selected robots receive preloads; unused artifacts remain in their alliance tray. All 36 artifacts are conserved.

Two-player mode runs on one computer, with separate keyboard controls, two standard controllers, or a controller plus the other player's keyboard controls. Online rooms are not implemented. The first observed controller drives Player 1; the second drives Player 2. Slots remain assigned if one disconnects, preventing controller takeover. Each player has independent launch power, elevation and turret aim. The camera is shared.

| Action                                 | Player 1                            | Player 2              | Standard PS5 mapping                      |
| -------------------------------------- | ----------------------------------- | --------------------- | ----------------------------------------- |
| Drive                                  | WASD (arrows also in single player) | Arrow keys            | Left stick                                |
| Turn                                   | Q / E                               | Comma / period        | Right stick X                             |
| Rotate turret                          | Z / X (hold)                        | K / L (hold)          | Hold R1 + right stick X                   |
| Center turret                          | V                                   | J                     | R3                                        |
| Toggle intake                          | R                                   | I                     | L1                                        |
| Reverse intake                         | B hold                              | U hold                | Circle hold                               |
| Shoot                                  | Space                               | Slash                 | R2 / Cross                                |
| Push own alliance gate                 | F hold nearby                       | O hold nearby         | Square hold                               |
| Precision speed                        | Left Shift                          | Right Shift           | L2                                        |
| Change shared camera                   | C                                   | On-screen picker      | Triangle                                  |
| Pause / resume                         | Enter                               | On-screen button      | Options                                   |
| Launch power / elevation               | −/+ and [/] or Aim & shoot panel    | P2 tab in Aim & shoot | D-pad left/right = power; up/down = angle |
| Human-player feed to Player 1 alliance | H / Feed tray                       | —                     | On-screen button                          |

Field/Top views use field-relative movement. Follow view rotates both players' controls with Player 1's camera. Intake starts off, accepts at most three artifacts and applies force through the front roller. Flywheel spin-up, cooldown and launcher recoil are simulated. Physical PS5 hardware has not been tested; standard Gamepad API input is tested synthetically.

## Turret, shooting and real robot CAD

The **Aim & shoot** panel is first in the driver station. Hold the large on-screen Turn left / Turn right buttons or the turret keys to aim separately from the chassis. Center returns the turret forward; Track goal restores assisted aiming for that player. Turrets accelerate and brake, slew at up to 1.6 rad/s, and stop at ±170°. These are simulator motor assumptions. Shots and the trajectory guide follow the current barrel bearing; assisted shots wait for alignment. Manual shots inherit chassis and turret muzzle velocity.

Power and angle have always-enabled setup sliders, large +/- buttons, numerical readouts and independent P1/P2 tabs. Adjusting either keeps turret tracking active while switching only that player's ballistics to manual settings. **Match goal distance** restores calculated ballistics. Both players can queue one on-screen shot while the flywheel spins up and the turret aligns. Range fitting compensates for chassis and turret motion; there is no autonomous driving.

The **Real FTC robot library** comes preloaded with two existing DECODE designs, assigned across all four slots: **Sideswipe V3 by Adrian Contraș (Romania)** and **Cicada × Matrix by teams 31678 and 19348 (Libya)**. Select a robot slot and a design to change it. Sideswipe is the author's final competition design; Cicada × Matrix is a 30-hour CAD concept. These are not claims of world rankings. Models load from bundled GLBs with no account or Blender installation. STEP sources have been tessellated and simplified for browser rendering. Original fixed shooters remain visible and the simulator adds an elevated rotating turret; these adaptations do not reconstruct the original mechanisms or measured performance.

Credits, source links, modifications and asset-specific licenses are in [public/models/CREDITS.md](public/models/CREDITS.md). **Sideswipe assets are limited to personal, educational, research and non-commercial use**, independently of any application source-code license. The Cicada source is released under the Unlicense. The offline conversion scripts are `scripts/convert-robot-cad.py`, `scripts/optimize-robot-model.py` and `scripts/stamp-robot-model.mjs`. Raw CAD archives and conversion dependencies are not shipped.

For a custom model, expand **Import your own Blender model** in the library, choose a robot slot, then Choose GLB. In Blender use File → Export → glTF 2.0, select **glTF Binary (.glb)**, embed textures, and disable compression. Use rigid meshes (no armature); keep files under 30 MB and 300,000 triangles. The importer validates self-contained resources, parses glTF materials and geometry, fits the model within a 44 cm square and 48 cm height, and rests it at floor level. Imports pause play and remain through field resets and player changes until page reload. Files are processed in the browser, not uploaded or saved to an account.

Parent turret parts to a single object named **Turret**, placing its origin at the rotation joint. The importer rotates that assembly about the vertical axis while preserving its initial geometry transforms. Blender +Y is forward with the standard glTF export axis conversion; Rotate model 90° corrects visual orientation. A model without a named turret retains the simulator's visible turning launcher. Use training chassis removes the custom model. Imported geometry is cosmetic: standard chassis colliders, mass and intake remain in use. For models without a Turret group, the added launcher's height sits above the fitted CAD, and that height is used for both trajectory prediction and ball flight. Custom Turret groups retain the standard muzzle configuration, so align their parts accordingly. Skeletal animation, compressed meshes and external textures are not supported.

References: [Blender glTF export](https://docs.blender.org/manual/en/3.0/addons/import_export/scene_gltf2.html), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

## Timer and scoring

The optional manual timer starts at 2:00 and runs directly to zero. There is no autonomous or transition countdown. Wall-clock timing is independent of rendering speed; explicit pause or loss of window focus pauses practice. After zero, controls stop and physics settles before final scoring.

The scoreboard shows blue/red totals, time, magazine, motif and selected robot's ramp. Final results show manual artifact, pattern and return-to-base points. Classified/overflow artifacts score 3/1, motif positions score 2, and approximate base scoring is included for the human-controlled robots. This manual session is not a complete official match format. Depot points, ranking points and most referee fouls are not implemented.

## Physics and limits

Three.js rendering and Rapier rigid-body dynamics at 120 Hz, SI units, gravity 9.81 m/s², continuous collision detection, bounded motor forces, friction, restitution and recoil. Mecanum translation and turning share a wheel-speed budget. Manual shots inherit chassis and turret muzzle tangential velocity; aim assist compensates platform motion. The trajectory guide, range estimate and assisted launch use the same quadratic-drag flight model.

Ramps have 148 mm clear lanes for nominal 127 mm balls. The gate is a pivoting push arm: its contact point moves approximately 51 mm horizontally and drops to approximately 76 mm above the floor, based on Figure 9-16. The upper bar clears the ball lane and gravity returns the gate. Both the linkage and field geometry are hand-modeled approximations, not official CAD. Goal markers use the 36h11 patterns for ID 20 (blue) and ID 24 (red), parented to the diagonal basket front wall and facing into the field. Patterns come from [AprilRobotics/apriltag-imgs](https://github.com/AprilRobotics/apriltag-imgs). The simulator does not include a camera vision pipeline.

Goal-to-ramp routing is scripted after a valid top entry. Robot roll/pitch is constrained. Mass, traction, friction, damping, restitution and aerodynamic parameters are not calibrated against hardware. Constant drag coefficient 0.47 and air density 1.225 kg/m³ are assumptions; perforations, wind, Magnus lift and Reynolds-number variation are omitted.

Sources: [FIRST TU32 manual and field diagrams](https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm), [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).

## Development and verification

`npm install`, `npm run dev`, `npm test`, `npm run build`.

Tests cover all four robot selections and alliance goals/gates, same-alliance multiplayer, immediate manual controls, parked robots, timed settling, final-score reconciliation, ball conservation, nine-ball gate release, intake/reverse, collisions, drag prediction, recoil-related muzzle velocity and two-controller isolation/disconnection, independent turret aim, cable limits, recentering, barrel-directed shots, real GLB parsing, invalid import recovery and model identity across robot swaps. TypeScript and production builds are checked separately. Visual browser QA and real controller hardware testing have not been performed.

### Rebuilding the robot render assets

Use Python with `cadquery-ocp`, `trimesh`, `numpy`, `pillow` and `fast-simplification` installed. Download the linked STEP source under its original license, then run the conversion outside the web runtime. For Sideswipe use a 220,000-triangle target and an 18 mm small-detail threshold; for Cicada use the defaults. Shape constraints may prevent the first simplification from reaching its target, so run the final cleanup before importing.

```sh
python scripts/convert-robot-cad.py INPUT.step intermediate.glb 0 0 220000 18
python scripts/optimize-robot-model.py intermediate.glb public/models/sideswipe-v3.glb -90 0
node scripts/stamp-robot-model.mjs public/models/sideswipe-v3.glb sideswipe-v3
```

Both supplied CAD sources have Z up and the intake toward +Y; the final −90° X rotation maps them to glTF Y up / −Z forward. A cached `.xbf` assembly is retained beside the input STEP to avoid repeating the expensive CAD import. Source render colors are approximated with glTF materials.
