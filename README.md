# DECODE manual simulator

Unofficial FIRST Tech Challenge 2025–26 DECODE manual driving practice. Autonomous play, AI robot routines and the AUTO/transition phases have been removed. Choose a two-minute manual session or untimed manual practice; all driver controls are available immediately after Start driving.

## Robots and players

Choose **Single player** or **Multiplayer · local** above the field. Player 1 can select Blue 1, Blue 2, Red 1 or Red 2. In multiplayer, Player 2 selects a different robot; cooperative same-alliance play and opposing-alliance play both work. Robot colors, labels, spawn positions, goal targeting, gate, loading tray and driver telemetry follow the selection. Changing robot, mode or session length resets the field.

All four robots remain visible. Unselected robots have no driving, shooting or intake routine and remain parked unless moved by contact. Only selected robots receive preloads; unused artifacts remain in their alliance tray. All 36 artifacts are conserved.

Two-player mode runs on one computer, with separate keyboard controls, two standard controllers, or a controller plus the other player's keyboard controls. Online rooms are not implemented. The first observed controller drives Player 1; the second drives Player 2. Slots remain assigned if one disconnects, preventing controller takeover. Both players share manual launch speed, elevation and the camera. Each player aims their turret independently.

| Action | Player 1 | Player 2 | Standard PS5 mapping |
|---|---|---|---|
| Drive | WASD (arrows also in single player) | Arrow keys | Left stick |
| Turn | Q / E | Comma / period | Right stick X |
| Rotate turret | Z / X (hold) | K / L (hold) | Hold R1 + right stick X |
| Center turret | V | J | R3 |
| Toggle intake | R | I | L1 |
| Reverse intake | B hold | U hold | Circle hold |
| Shoot | Space | Slash | R2 / Cross |
| Push own alliance gate | F hold nearby | O hold nearby | Square hold |
| Precision speed | Left Shift | Right Shift | L2 |
| Change shared camera | C | On-screen picker | Triangle |
| Pause / resume | Enter | On-screen button | Options |
| Manual launch speed / elevation | −/+ and [/] | Shared settings | D-pad |
| Human-player feed to Player 1 alliance | H / Feed tray | — | On-screen button |

Field/Top views use field-relative movement. Follow view rotates both players' controls with Player 1's camera. Intake starts off, accepts at most three artifacts and applies force through the front roller. Flywheel spin-up, cooldown and launcher recoil are simulated. Physical PS5 hardware has not been tested; standard Gamepad API input is tested synthetically.

## Turret and Blender models

Hold the on-screen Left/Right buttons or the turret keys to aim separately from the chassis. Center returns the turret forward; Track goal restores assisted aiming for that player. Turrets accelerate and brake, slew at up to 1.6 rad/s, and stop at ±170°. These are simulator motor assumptions. Shots and the trajectory guide follow the current barrel bearing; assisted shots wait for alignment. Manual shots inherit chassis and turret muzzle velocity.

Open **Blender robot models** above the field and choose any of the four robot identities, then Import GLB. In Blender use File → Export → glTF 2.0, select **glTF Binary (.glb)**, embed textures, and disable compression. Use rigid meshes (no armature); keep files under 30 MB and 300,000 triangles. The importer validates self-contained resources, parses glTF materials and geometry, fits the model within a 44 cm square and 48 cm height, and rests it at floor level. Imports pause play and remain through field resets and player changes until page reload. Files are processed in the browser, not uploaded or saved to an account.

Parent turret parts to a single object named **Turret**, placing its origin at the rotation joint. The importer rotates that assembly about the vertical axis while preserving its initial geometry transforms. Blender +Y is forward with the standard glTF export axis conversion; Rotate model 90° corrects visual orientation. A model without a named turret retains the simulator's visible turning launcher. Restore default removes the custom model. Imported geometry is cosmetic: standard chassis colliders, mass, intake and muzzle coordinates remain in use, so align custom parts accordingly. Skeletal animation, compressed meshes and external textures are not supported.

References: [Blender glTF export](https://docs.blender.org/manual/en/3.0/addons/import_export/scene_gltf2.html), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

## Timer and scoring

The optional manual timer starts at 2:00 and runs directly to zero. There is no autonomous or transition countdown. Wall-clock timing is independent of rendering speed; explicit pause or loss of window focus pauses practice. After zero, controls stop and physics settles before final scoring.

The scoreboard shows blue/red totals, time, magazine, motif and selected robot's ramp. Final results show manual artifact, pattern and return-to-base points. Classified/overflow artifacts score 3/1, motif positions score 2, and approximate base scoring is included for the human-controlled robots. This manual session is not a complete official match format. Depot points, ranking points and most referee fouls are not implemented.

## Physics and limits

Three.js rendering and Rapier rigid-body dynamics at 120 Hz, SI units, gravity 9.81 m/s², continuous collision detection, bounded motor forces, friction, restitution and recoil. Mecanum translation and turning share a wheel-speed budget. Manual shots inherit chassis and turret muzzle tangential velocity; aim assist compensates platform motion. The trajectory guide, range estimate and assisted launch use the same quadratic-drag flight model.

Ramps have 148 mm clear lanes for nominal 127 mm balls. The gate is a pivoting push arm: its contact point moves approximately 51 mm horizontally and drops to approximately 76 mm above the floor, based on Figure 9-16. The upper bar clears the ball lane and gravity returns the gate. Both the linkage and field geometry are hand-modeled approximations, not official CAD.

Goal-to-ramp routing is scripted after a valid top entry. Robot roll/pitch is constrained. Mass, traction, friction, damping, restitution and aerodynamic parameters are not calibrated against hardware. Constant drag coefficient 0.47 and air density 1.225 kg/m³ are assumptions; perforations, wind, Magnus lift and Reynolds-number variation are omitted.

Sources: [FIRST TU32 manual and field diagrams](https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm), [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).

## Development and verification

`npm install`, `npm run dev`, `npm test`, `npm run build`.

Tests cover all four robot selections and alliance goals/gates, same-alliance multiplayer, immediate manual controls, parked robots, timed settling, final-score reconciliation, ball conservation, nine-ball gate release, intake/reverse, collisions, drag prediction, recoil-related muzzle velocity and two-controller isolation/disconnection, independent turret aim, cable limits, recentering, barrel-directed shots, real GLB parsing, invalid import recovery and model identity across robot swaps. TypeScript and production builds are checked separately. Visual browser QA and real controller hardware testing have not been performed.
