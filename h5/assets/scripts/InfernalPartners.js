/* Third-act companions, driven by real target, work and stun states. */
(function (root) {
    'use strict';

    const { rotate, solve } = root.WZMinerRig || require('./MinerRig');
    const palette = {
        jade: '#80ffb9', flame: '#62ffa3', cloth: '#d3acf9', relic: '#bcdcbf',
        stone: '#81e6b2', trim: '#c3eec6', eyes: '#e5f3bc'
    };
    const shade = hex => new cc.Color(...hex.slice(1).match(/../g).map(value => parseInt(value, 16)), 255);
    const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
    const smooth = n => { const x = clamp(n); return x * x * (3 - 2 * x); };
    const mix = (a, b, t) => a + (b - a) * t;
    const ramp = (t, a, b) => smooth((t - a) / (b - a));
    const atlasFor = type => type === 'ji' ? 'infernalGhost' : 'infernalCoffin';

    function create(parent, texture, data, partner) {
        const ghost = partner.type === 'ji', superForm = partner.form === 2;
        const node = new cc.Node(ghost ? 'Infernal foreman' : 'Devouring sarcophagus');
        parent.addChild(node);
        const pieces = {}, frames = {};
        const size = superForm ? 1.08 : 1;
        let facing = 1, lastTime = null, lift = 0;
        function frame(key) {
            if (!frames[key]) {
                const f = data.frames[key];
                frames[key] = new cc.SpriteFrame(texture, cc.rect(f.x, f.y, f.w, f.h));
            }
            return frames[key];
        }
        function joint(name, parent, x, y, z) {
            const part = new cc.Node(name);
            parent.addChild(part);
            part.setPosition(x, y);
            part.zIndex = z;
            return part;
        }
        function art(name, key, w, h, x, y, z, ax = .5, ay = .5, owner = node) {
            const part = joint(name, owner, x, y, z);
            part.setContentSize(w, h);
            part.anchorX = ax;
            part.anchorY = ay;
            const sprite = part.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame(key);
            pieces[name] = { node: part, sprite };
            return part;
        }
        function colorParts(hex, names) {
            for (const name of names) if (pieces[name]) pieces[name].node.color = shade(hex);
        }
        const updateArt = ghost ? makeGhost() : makeCoffin();

        function makeGhost() {
            const tail = art('Tail', 'tail', 48, 34, -1, 52, 0, .48, .90);
            const body = art('Body', 'torso', superForm ? 56 : 48, 44, 0, 47, 3, .52, 0);
            const head = art('Head', 'idle', superForm ? 61 : 55, superForm ? 67 : 59, 3, 34, 2, .51, .10, body);
            // The painted sleeves are diagonal. Align their openings to the IK joints.
            function alignSleeve(sprite, endX, endY, length) {
                const dx = (endX - sprite.anchorX) * sprite.width;
                const dy = Math.sqrt(Math.max(1, length * length - dx * dx));
                sprite.height = dy / (sprite.anchorY - endY);
                sprite.angle = -Math.atan2(dx, dy) * 180 / Math.PI;
            }
            function arm(name, front) {
                const side = front ? 'Front' : 'Rear';
                const shoulder = joint(name + ' shoulder', node, 0, 0, front ? 4 : 2);
                const upper = art(name + ' upper', 'upper' + side, 19, 26, 0, 0, 0, .67, .87, shoulder);
                const elbow = joint(name + ' elbow', shoulder, 0, -21, 1);
                const cuff = art(name + ' cuff', 'fore' + side, 14, 22, 0, 0, 0, .23, .78, elbow);
                const hand = art(name + ' hand', 'hand' + side, 15, 16, 0, 0, front ? 7 : 6, .62, .38);
                return { shoulder, upper, elbow, cuff, hand };
            }
            const rear = arm('Rear', false), front = arm('Front', true);
            // The props and hands are positioned from the same grip, with the hand in front.
            const whip = art('Whip', 'whip', 34, 43, 0, 0, 6, .75, .88);
            const ledger = art('Attendance', superForm ? 'board' : 'ledger', superForm ? 28 : 22, superForm ? 34 : 28, 0, 0, 5, .80, .73);
            const extra = superForm ? art('Third arm', 'extraArm', 30, 37, -18, 83, 1, .38, .88) : null;
            const stamp = superForm ? art('Stamp', 'stamp', 18, 25, 12, -25, -1, .51, .63, extra) : null;
            colorParts(palette.jade, ['Head', 'Rear hand', 'Front hand', 'Third arm']);
            colorParts(palette.flame, ['Tail']);
            colorParts(palette.cloth, ['Body', 'Rear upper', 'Front upper', 'Rear cuff', 'Front cuff']);
            colorParts(palette.relic, ['Whip', 'Attendance', 'Stamp']);
            let face;
            function setArm(rig, shoulder, grip, angle, sign) {
                const wrist = rotate((.33 - rig.hand.anchorX) * rig.hand.width, (.73 - rig.hand.anchorY) * rig.hand.height, angle);
                const ik = solve(shoulder, { x: grip.x + wrist.x, y: grip.y + wrist.y }, 20, 15, sign);
                rig.shoulder.setPosition(shoulder.x, shoulder.y);
                rig.shoulder.angle = ik.a;
                alignSleeve(rig.upper, .55, .17, ik.l1);
                rig.elbow.setPosition(0, -ik.l1);
                rig.elbow.angle = ik.b - ik.a;
                alignSleeve(rig.cuff, .78, .40, ik.l2);
                rig.hand.setPosition(grip.x, grip.y);
                rig.hand.angle = angle;
            }
            return (state, t) => {
                const { phase, action, stun, step } = state;
                const wind = ramp(action, 0, .22) * (1 - ramp(action, .22, .38));
                const snap = ramp(action, .16, .38) * (1 - ramp(action, .52, 1));
                const float = Math.sin(t * 2.75) * (stun ? 1 : 3) - (stun ? 8 : 0);
                const lean = wind * 13 - snap * 9 - step * 4;
                body.setPosition(-wind * 3 + snap * 5, 47 + float);
                body.angle = lean;
                tail.setPosition(-snap * 5, 52 + float);
                tail.angle = Math.sin(t * 3.5 - .6) * 9 + wind * 12 - snap * 8;
                head.angle = -lean * .6 + (stun ? -8 : 0);
                const expression = stun ? 'dazed' : phase === 'urging' || phase === 'working' ? 'active' : 'idle';
                if (expression !== face) {
                    pieces.Head.sprite.spriteFrame = frame(expression);
                    face = expression;
                }
                const lashGrip = { x: 26 - wind * 7 + snap * 19, y: 52 + float + wind * 50 + snap * 10 - (stun ? 4 : 0) };
                const bookGrip = { x: -23 - wind * 2 + snap * 3, y: 61 + float + wind * 2 - (stun ? 5 : 0) };
                const shoulder = x => {
                    const d = rotate(x, 33, lean);
                    return { x: body.x + d.x, y: body.y + d.y };
                };
                whip.setPosition(lashGrip.x, lashGrip.y);
                whip.angle = -12 + wind * -96 + snap * 98;
                setArm(front, shoulder(15), lashGrip, whip.angle, 1);
                ledger.setPosition(bookGrip.x, bookGrip.y);
                ledger.angle = -8 + wind * 12;
                setArm(rear, shoulder(-15), bookGrip, ledger.angle, -1);
                if (extra) {
                    const press = ramp(action, .28, .52) * (1 - ramp(action, .64, .92));
                    extra.setPosition(-20 + press * 5, 82 + float - press * 6);
                    extra.angle = 11 - press * 25;
                    stamp.angle = -extra.angle;
                }
            };
        }

        function makeCoffin() {
            const width = superForm ? 102 : 90, feet = [];
            let chewTime = 0, gape = 5, crankAngle = 0, wasWorking = false;
            const shell = joint('Floating shell', node, 0, 0, 3);
            ['footRearL', 'footRearR', 'footFrontL', 'footFrontR'].forEach((key, i) => {
                const front = i >= 2;
                feet.push(art('Foot ' + i, key, 20, 20, (i % 2 ? 1 : -1) * width * .32, front ? 8 : 13, front ? 4 : 1, .5, .42));
            });
            const body = art('Body', 'body', width, 38, 0, 27, 3, .5, .43, shell);
            const lid = joint('Main lid hinge', shell, -width * .43, 38, 5);
            // The new fangs extend below the old crop. Keep the stone lid and hinge registered.
            const lidHeight = 42 * data.frames.lid.h / 80;
            art('Lid', 'lid', width + 3, lidHeight, 0, 0, 1, .085, 1 - 33.6 / lidHeight, lid);
            const eyes = art('Eyes', 'eyesIdle', 39, 17, width * .58, 8, 2, .5, .5, lid);
            const rollers = art('Rollers', 'roller', width * .61, 19, 0, 43, 1, .5, .5, shell);
            const ore = art('Mineral', 'mineral', 25, 17, 20, 44, 2, .5, .5, shell);
            const crank = art('Crank', 'crank', 30, 29, -width * .28, 27, 6, .55, .56, shell);
            const sides = [];
            if (superForm) for (const [i, sign] of [-1, 1].entries()) {
                const side = joint('Side jaw ' + i, node, sign * 49, i ? 0 : 4, i ? 4 : 2);
                art('Side base ' + i, i ? 'sideBaseR' : 'sideBaseL', 39, 21, 0, 23, 1, .5, .45, side);
                const hinge = joint('Side hinge ' + i, side, -15, 30, 2);
                art('Side lid ' + i, i ? 'sideLidR' : 'sideLidL', 39, 23, 0, 0, 1, .1, .22, hinge);
                sides.push({ side, hinge });
            }
            colorParts(palette.stone, ['Body', 'Lid', 'Side base 0', 'Side lid 0', 'Side base 1', 'Side lid 1',
                'Foot 0', 'Foot 1', 'Foot 2', 'Foot 3']);
            colorParts(palette.trim, ['Crank', 'Rollers', 'Mineral']);
            colorParts(palette.eyes, ['Eyes']);
            let workingEyes = false;
            return ({ phase, step, stun, dt }) => {
                const working = phase === 'working', walking = phase === 'moving';
                if (working && !wasWorking) chewTime = 0;
                if (working) {
                    chewTime += dt;
                    crankAngle = (crankAngle + dt * 255) % 360;
                }
                const beat = (chewTime * 3.1) % 1;
                const bite = Math.pow(Math.sin(beat * Math.PI), 2);
                const opening = ramp(beat, .03, .49) * (1 - ramp(beat, .61, .86));
                const target = stun ? 3 : working ? 3 + opening * 31 : walking ? 8 + Math.abs(step) * 4 : 5;
                const response = working && target < gape ? 53 : 28;
                gape = mix(gape, target, 1 - Math.exp(-dt * response));
                shell.setPosition(working ? Math.sin(beat * Math.PI * 2) * 1.4 : 0, walking ? Math.abs(step) * 2 : 0);
                body.angle = working ? (bite - .5) * 2 : 0;
                lid.angle = gape;
                eyes.angle = -gape * .17;
                if (workingEyes !== working) {
                    pieces.Eyes.sprite.spriteFrame = frame(working ? 'eyesWork' : 'eyesIdle');
                    workingEyes = working;
                }
                ore.active = working;
                ore.x = 27 - Math.min(1, chewTime * 2.2) * 24;
                ore.y = 45 - (1 - bite) * 6;
                ore.scale = .92 - Math.min(1, chewTime * 1.8) * .46;
                rollers.active = working;
                rollers.scaleY = working ? .78 + bite * .22 : 1;
                crank.angle = crankAngle;
                feet.forEach((foot, i) => {
                    const phaseStep = step * (i === 0 || i === 3 ? 1 : -1);
                    foot.angle = phaseStep * 13;
                    foot.x = (i % 2 ? 1 : -1) * width * .32 + phaseStep * 4;
                    foot.y = (i >= 2 ? 8 : 13) + Math.max(0, phaseStep) * 3;
                });
                sides.forEach(({ side, hinge }, i) => {
                    side.y = (i ? 0 : 4) + shell.y;
                    hinge.angle = working ? 4 + Math.pow(Math.sin((beat + (i ? .25 : .55)) * Math.PI), 2) * 24 : gape * .75;
                });
                wasWorking = working;
            };
        }

        const rig = {
            node, pieces, equipment: null, infernal: { superForm }, pose: null,
            update(p, time, action, moving, upgrade, focus) {
                const dt = lastTime === null ? 0 : clamp(time - lastTime, 0, .1);
                lastTime = time;
                const stun = p.stun > 0;
                const phase = stun ? 'stunned' : p.working ? 'working' : action > 0 ? 'urging' : moving ? 'moving' : 'idle';
                lift += ((phase === 'moving' ? 1 : 0) - lift) * (1 - Math.exp(-dt * 15));
                const step = stun ? 0 : Math.sin(time * (ghost ? 9 : 13)) * lift;
                const state = { phase, action: phase === 'urging' ? clamp(1 - action / .5) : 0, stun, step, dt };
                updateArt(state, time);
                const pulse = Math.sin(clamp(upgrade || 0) * Math.PI) * .05;
                if (focus && Math.abs(focus.x - p.x) > 10) facing = focus.x < p.x ? -1 : 1;
                node.scaleY = size * (1 + pulse);
                node.scaleX = node.scaleY * facing;
                node.angle = stun ? Math.sin(time * 11) * 6 : 0;
                this.pose = state;
                return state;
            }
        };
        rig.update(partner, 0, 0, false, 0);
        return rig;
    }

    const api = { create, atlasFor, palette };
    if (typeof module !== 'undefined') module.exports = api;
    root.WZInfernalPartners = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
