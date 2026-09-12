# DECODE simulator

Unofficial FIRST Tech Challenge 2025–26 DECODE driver and four-robot match practice, based on the official TU32 manual and field illustrations. No claim of complete referee coverage or calibrated engineering accuracy.

## Controls

| Action | Keyboard | Standard PS5 mapping |
|---|---|---|
| Drive (field-relative; robot-relative in Follow) | WASD / arrows | Left stick |
| Rotate | Q / E | Right stick X |
| Toggle front intake | R | L1 |
| Reverse intake | B (hold) | Circle (hold) |
| Shoot | Space | R2 / Cross |
| Push blue gate, on left | F (hold near lever) | Square (hold) |
| Precision speed | Shift | L2 |
| Change camera | C | Triangle |
| Pause / start | Enter | Options |
| Manual shot speed | − / + | D-pad left / right |
| Manual shot elevation | [ / ] | D-pad down / up |
| Human-player feed | H / Feed tray | On-screen button |

Intake starts OFF and accepts at most three artifacts. The roller applies a bounded capture force in its front mouth, and reverse physically ejects an artifact. A shot waits for flywheel spin-up. Aim assist compensates for chassis velocity. Manual shots inherit chassis translation and muzzle tangential velocity from robot rotation and support 3–11 m/s launch speed and 25–75° elevation, with an estimated range at goal height. The blue gate approach marker and distance prompt show where to hold F; F also works after focusing a settings switch. The broadcast scoreboard sits below the field, with blue/red totals, a central clock and motif. Final results show both alliances and a reconciled AUTO/TELEOP scoring breakdown. Physical PS5 hardware has not been tested; synthetic standard Gamepad API input is covered by tests.

## Match practice

Enable **Four-robot match practice** to add a blue partner and two red practice bots. All four robots have rigid-body colliders and motor forces. Match timing is 30 seconds of preset autonomous, 8 seconds of transition, and 120 seconds of teleop. Driver motion/intake/shooting are locked during autonomous and transition. The bots use basic collect, shoot, clear-gate, and return-to-base routines, not recorded match strategies.

Motif is randomized among GPP, PGP and PPG. Initial staging is 18 artifacts on spike marks (near GPP / middle PGP / far PPG, center out), 3 per loading zone, and 6 per alliance tray; robot preloads come from those trays. Match mode preloads all four robots with three, conserving 36 artifacts (24 purple, 12 green). Free drive retains the other artifacts in human-player trays. Out-of-field artifacts return to a tray; they are not recreated. Human-player feed requires the blue loading zone to be clear.

Blue goal/gate are on the audience's left; blue loading/base are on the right. Opening the blue gate returns artifacts into the red side's lane. Classified/overflow scores are 3/1. Pattern positions score 2 after autonomous and at the end of teleop; leave and approximate base scoring are included. Physics continues after the buzzer until settling, with a 15-second cap.

## Physics and remaining approximations

Three.js rendering with shadows, materials and modeled robot parts. Rapier rigid-body dynamics at a fixed 120 Hz, SI units, gravity 9.81 m/s², continuous collision detection, traction-capped motor forces, friction, rolling, restitution, and launcher recoil. Dynamic balls physically roll along inclined classifier ramps with 148 mm clear lanes for 127 mm balls. A hinged gate swings forward and upward to release the queue; all nine balls are covered by the release test. Driving uses timestep-aware motor response, acceleration and braking limits, and a shared mecanum wheel-speed budget for translation and turning. Air resistance uses quadratic sphere drag; the aiming guide, range estimate and assisted launcher solve the same flight model. Recoil uses the relative exit momentum at the muzzle. Gate motion uses a damped gravity-linkage approximation requiring nearby actuation.

Goal-to-square routing remains scripted after a valid top-entry sensor. Geometry is a hand-modeled approximation, not official CAD. Motor force, mass, friction, restitution and damping have not been calibrated against hardware. Air density 1.225 kg/m³ and constant Cd 0.47 are modeling assumptions; perforation, Reynolds-number changes, wind and Magnus lift are not modeled. Drag equation reference: https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/. Robot roll/pitch is constrained. Base/leave geometry is approximate. Depot points, ranking points, most interaction fouls, advanced autonomous programming, robot customization and network multiplayer are not implemented. The supplied YouTube video could not be loaded for frame-by-frame comparison; the authoritative field illustrations were inspected instead.

Official source: https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm (sections 9–11).

## Run and checks

`npm install`, `npm run dev`, `npm test`, `npm run build`.

Tests exercise the same field construction and physics stepping used in the game: counts and staging, spin-up and valid goal entry, single-ball and full nine-ball gate release/gravity return, keyboard focus handling, manual shot range and inherited velocity, timestep consistency, Rapier-versus-guide flight within 4 cm across three test velocities, shared wheel-speed limits, rotating-muzzle velocity and final-score reconciliation, intake off/on and reverse, wall collisions, launch guards, motif/base scoring, four robots, full match phases including the 120-second teleop, post-buzzer settling, conservation of artifacts, and synthetic controller movement/toggle/pause.

TypeScript and production build are checked separately. Visual browser QA and real gamepad testing have not been performed. Optional WebMCP tools remain feature-detected; no supported WebMCP validation context was available.
