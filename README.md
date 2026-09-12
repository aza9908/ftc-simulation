# DECODE manual simulator

Unofficial FIRST Tech Challenge 2025–26 DECODE manual driving practice. Autonomous play, AI robot routines and the AUTO/transition phases have been removed. Choose a two-minute manual session or untimed manual practice; all driver controls are available immediately after Start driving.

## Robots and players

Choose **Single player** or **Multiplayer · local** above the field. Player 1 can select Blue 1, Blue 2, Red 1 or Red 2. In multiplayer, Player 2 selects a different robot; cooperative same-alliance play and opposing-alliance play both work. Robot colors, labels, spawn positions, goal targeting, gate, loading tray and driver telemetry follow the selection. Changing robot, mode or session length resets the field.

All four robots remain visible. Unselected robots have no driving, shooting or intake routine and remain parked unless moved by contact. Only selected robots receive preloads; unused artifacts remain in their alliance tray. All 36 artifacts are conserved.

Two-player mode runs on one computer, with separate keyboard controls, two standard controllers, or a controller plus the other player's keyboard controls. Online rooms are not implemented. The first observed controller drives Player 1; the second drives Player 2. Slots remain assigned if one disconnects, preventing controller takeover. Both players share launcher settings and the camera.

| Action | Player 1 | Player 2 | Standard PS5 mapping |
|---|---|---|---|
| Drive | WASD (arrows also in single player) | Arrow keys | Left stick |
| Turn | Q / E | Comma / period | Right stick X |
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

## Timer and scoring

The optional manual timer starts at 2:00 and runs directly to zero. There is no autonomous or transition countdown. Wall-clock timing is independent of rendering speed; explicit pause or loss of window focus pauses practice. After zero, controls stop and physics settles before final scoring.

The scoreboard shows blue/red totals, time, magazine, motif and selected robot's ramp. Final results show manual artifact, pattern and return-to-base points. Classified/overflow artifacts score 3/1, motif positions score 2, and approximate base scoring is included for the human-controlled robots. This manual session is not a complete official match format. Depot points, ranking points and most referee fouls are not implemented.

## Physics and limits

Three.js rendering and Rapier rigid-body dynamics at 120 Hz, SI units, gravity 9.81 m/s², continuous collision detection, bounded motor forces, friction, restitution and recoil. Mecanum translation and turning share a wheel-speed budget. Manual shots inherit chassis and muzzle tangential velocity; aim assist compensates platform motion. The trajectory guide, range estimate and assisted launch use the same quadratic-drag flight model.

Ramps have 148 mm clear lanes for nominal 127 mm balls. The gate is a pivoting push arm: its contact point moves approximately 51 mm horizontally and drops to approximately 76 mm above the floor, based on Figure 9-16. The upper bar clears the ball lane and gravity returns the gate. Both the linkage and field geometry are hand-modeled approximations, not official CAD.

Goal-to-ramp routing is scripted after a valid top entry. Robot roll/pitch is constrained. Mass, traction, friction, damping, restitution and aerodynamic parameters are not calibrated against hardware. Constant drag coefficient 0.47 and air density 1.225 kg/m³ are assumptions; perforations, wind, Magnus lift and Reynolds-number variation are omitted.

Sources: [FIRST TU32 manual and field diagrams](https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm), [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/).

## Development and verification

`npm install`, `npm run dev`, `npm test`, `npm run build`.

Tests cover all four robot selections and alliance goals/gates, same-alliance multiplayer, immediate manual controls, parked robots, timed settling, final-score reconciliation, ball conservation, nine-ball gate release, intake/reverse, collisions, drag prediction, recoil-related muzzle velocity and two-controller isolation/disconnection. TypeScript and production builds are checked separately. Visual browser QA and real controller hardware testing have not been performed.
