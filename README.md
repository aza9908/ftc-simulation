# DECODE driver simulator

Unofficial solo driver practice inspired by the FIRST Tech Challenge 2025–26 DECODE competition manual TU32. This is a playable prototype, not a full competition or engineering validation simulator.

## Play

- WASD / arrows: field-relative translation. Q/E: rotate robot.
- Space: shoot. Automatic aiming is enabled initially; disable it for manual heading and speed.
- F (hold): push the blue gate while near its blue marked actuation zone.
- Shift: precision speed. Enter: start/pause. C: camera.
- Automatic front intake, maximum 3 artifacts.
- PS5 DualSense: connect with USB/Bluetooth, press a button to expose it to the browser. Standard Gamepad API mapping: left stick move, right stick X turn, R2/Cross shoot, Square hold gate, L2 precision, Triangle camera, Options pause.

## Implementation

Three.js renders the 3D field with dynamic shadows, tone mapping, metal materials, modeled robot parts and balls. Rapier 3D simulates rigid-body contacts at a fixed 120 Hz, with SI units, gravity 9.81 m/s², continuous collision detection, traction-capped motor impulses, restitution and friction. Gate angle uses a damped, gravity-driven linkage approximation driving its physical collider. Ball flight is simulated, not animated; aim assist computes its initial ballistic velocity.

The field model has a 3.6576 m square interior, 0.127 m balls, 36 artifacts in the 24-purple/12-green ratio, two goals, and inclined physical classifier ramps. Goal-to-square routing is scripted after an entry sensor, after which classified balls physically roll down the ramp, are retained by the gate, and can roll out and be collected again. Exact CAD, measured material properties, flexible-body deformation, motor electrical models, and real DualSense hardware validation are not included.

Free drive and 120-second solo teleop practice are available. Classified/overflow values are 3/1, motif GPP positions score 2 at timed-session end. Base scoring uses a simplified bounding-area test. No opponents, autonomous programming, depot tally, full referee rules, ranking points, or official field placement certification. Timer freezes the session at zero; post-match settling is not simulated. Manual dimensions and rules reference: https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm (sections 9–11).

## Run and validate

`npm install`, `npm run dev`, `npm run build`, `npm test`.

Headless physics checks use the same simulator field construction and step functions: artifact inventory, assisted shot scoring, physical gate release and gravity return, field wall collision, legal launch-zone guard, pattern scoring, bounded traction, timer, and synthetic standard-gamepad movement/pause. Physical PS5 controller and visual browser QA have not been performed. Optional WebMCP tools are feature-detected; no supported WebMCP validation context was available.
