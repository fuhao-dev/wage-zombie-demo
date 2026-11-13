/* Third-act art rig. Samples the existing work timer without modifying the model. */
(function (root) {
    'use strict';

    const { rotate, solve } = root.WZMinerRig || require('./MinerRig');
    const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
    const smooth = v => { const q = clamp(v); return q * q * (3 - 2 * q); };
    const mix = (from, to, amount) => from + (to - from) * amount;
    const ramp = (p, from, to) => smooth((p - from) / (to - from));

    const specs = {
        8: { key: 'infernalChisel', name: 'Rift chisel worker', body: [49, 56], head: [53, 64], headX: .49, headY: 49, shoulder: 16, shoulderY: 43, arm: [32, 33], armWidth: [16, 11], leg: [24, 25], legWidth: [17, 24], hand: [14, 17], hip: 10, hipY: 45, feet: 18 },
        9: { key: 'infernalClaw', name: 'Bone claw worker', body: [51, 55], head: [57, 60], headX: .48, headY: 48, shoulder: 17, shoulderY: 42, arm: [32, 34], armWidth: [16, 12], leg: [24, 25], legWidth: [18, 24], hand: [25, 31], hip: 11, hipY: 44, feet: 19 },
        10: { key: 'infernalKing', name: 'Crowned horn king', body: [53, 64], head: [50, 69], headX: .47, headY: 56, shoulder: 17, shoulderY: 46, arm: [34, 34], armWidth: [16, 11], leg: [26, 27], legWidth: [17, 23], hand: [14, 16], hip: 10, hipY: 49, feet: 18 },
        11: { key: 'infernalBrute', name: 'Obsidian stomp worker', body: [79, 69], head: [66, 67], headX: .50, headY: 60, shoulder: 27, shoulderY: 48, arm: [38, 40], armWidth: [32, 25], leg: [28, 29], legWidth: [29, 37], hand: [25, 26], hip: 16, hipY: 50, feet: 26 }
    };
    // Coordinates on the painted tools, measured from their sprite anchors.
    const grips = {
        8: [[-1, -25, 26], [0, -43, -25]],
        10: [[14, -11, 43], [14, -25, -7]],
        11: [[-4, -20, 32], [1, -41, -22]]
    };
    const palmAnchor = [.50, .34];
    const clawAnchor = [.49, .89];
    const wristAnchor = [.50, .88];
    const clawTips = [[.41, .04], [.62, .04]];
    const scale = .94;
    const palette = { soul: '#a7f0a3', spark: '#d8eab7', mist: '#7da990' };

    function offset(point, x, y, angle) {
        const d = rotate(x, y, angle);
        return { x: point.x + d.x, y: point.y + d.y };
    }

    function pose(kind, work = { phase: 'idle' }, time = 0, rest = 0, hit = 0) {
        const spec = specs[kind];
        const p = clamp(work.progress || 0);
        const idle = work.phase === 'idle';
        const tired = idle ? clamp(rest) : ramp(p, .79, .98);
        const flinch = idle ? 0 : ramp(p, 0, .042) * (1 - ramp(p, .049, .13));
        const plant = idle ? 0 : ramp(p, .32, .47) * (1 - ramp(p, .76, .91));
        const lower = idle ? 0 : ramp(p, .51, .61);
        const lift = idle ? 1 : 1 - lower * (1 - ramp(p, .69, .82));
        const walk = work.walking ? Math.sin(work.step || 0) : 0;
        const sway = Math.sin(time * 2.4) * .45;
        const out = {
            hipX: plant * (kind === 9 ? 6 : 2) - flinch * 4,
            hipY: spec.hipY + sway + flinch * 2 - tired * 3 - plant * (kind === 9 ? 8 : 2),
            lean: -5 - tired * 8 - plant * (kind === 9 ? 17 : 5) + flinch * 12 + hit * 4,
            headAngle: -3 - tired * 7 + flinch * 9 + plant * 4,
            face: work.phase === 'startled' ? 'startled' : tired > .12 || work.phase === 'finish' ? 'tired'
                : idle ? 'idle' : 'effort',
            working: work.phase === 'dig',
            voice: 0
        };
        let tip;
        if (kind === 8) {
            // Hold the tip still through contact, then lever it up and out of the seam.
            const wind = idle ? 0 : ramp(p, .35, .51) * (1 - lower);
            const pry = idle ? 0 : ramp(p, .645, .73) * (1 - ramp(p, .73, .88));
            out.toolAngle = 8 * lift - 8 * wind - pry * 16;
            tip = { x: 37 - 3 * wind + pry * 3, y: (10 - tired * 3 + wind * 28) * lift };
            const axis = rotate(0, 76, out.toolAngle);
            out.toolX = tip.x + axis.x;
            out.toolY = tip.y + axis.y;
        } else if (kind === 9) {
            // Reach down in front of the toes, rake back while the talons are planted.
            const reach = idle ? 0 : ramp(p, .38, .54);
            const rake = idle ? 0 : ramp(p, .61, .696);
            const release = idle ? 0 : ramp(p, .69, .86);
            const touch = lower * (1 - release);
            const carry = [{ x: -14 + tired * 3, y: 61 - tired * 8 }, { x: 30, y: 60 - tired * 10 }];
            out.handAngles = [];
            out.hands = carry.map((hand, i) => {
                const x = (i ? 64 : 38) - rake * (i ? 23 : 18);
                const angle = mix(i ? -22 : 24, -6 - rake * 13, reach * (1 - release));
                out.handAngles.push(angle);
                const [tipX, tipY] = clawTips[i];
                const talon = rotate((tipX - clawAnchor[0]) * spec.hand[0], (tipY - clawAnchor[1]) * spec.hand[1], angle);
                const y = mix(hand.y, mix(47, -talon.y, touch), reach * (1 - release));
                const wrist = { x: mix(hand.x, x, reach * (1 - release)), y };
                if (i === 1) tip = { x: wrist.x + talon.x, y: Math.max(0, wrist.y + talon.y) };
                return wrist;
            });
            out.toolX = out.hands[1].x;
            out.toolY = out.hands[1].y;
            out.toolAngle = out.handAngles[1];
        } else if (kind === 10) {
            const raise = idle ? 0 : ramp(p, .31, .49) * (1 - ramp(p, .75, .89));
            out.voice = out.working ? ramp(p, .48, .56) * (1 - ramp(p, .71, .79)) : 0;
            out.headAngle += out.voice * Math.sin(time * 36) * 1.5;
            const neck = offset({ x: out.hipX, y: out.hipY }, 1, spec.headY, out.lean);
            const mouth = offset(neck, 16, 21, out.lean + out.headAngle);
            out.toolX = mix(20, mouth.x, raise);
            out.toolY = mix(65 - tired * 7, mouth.y, raise);
            out.toolAngle = mix(-49, -3 + out.voice * Math.sin(time * 38), raise);
            tip = offset({ x: out.toolX, y: out.toolY }, 58, 5, out.toolAngle);
        } else {
            // Weight transfers onto the pillar and rear foot before the front boot lands.
            const brace = idle ? 0 : ramp(p, .39, .49) * (1 - ramp(p, .72, .88));
            const stomp = idle ? 0 : ramp(p, .43, .50) * (1 - ramp(p, .53, .61));
            out.hipX -= brace * 5;
            out.hipY += stomp * 4 - (1 - lift) * 4;
            out.lean -= brace * 6;
            out.toolX = 32;
            out.toolY = 85 + (1 - brace) * (8 - tired * 5);
            out.toolAngle = (1 - brace) * -4;
            out.stomp = stomp;
            tip = { x: spec.feet + 9, y: 0 };
        }
        if (kind !== 9) {
            out.hands = grips[kind].map(([x, y]) => offset({ x: out.toolX, y: out.toolY }, x, y, out.toolAngle));
            out.handAngles = grips[kind].map(([, , turn]) => out.toolAngle + turn);
        }
        out.contact = tip;
        out.arms = [-1, 1].map((sign, i) => {
            const start = offset({ x: out.hipX, y: out.hipY }, sign * spec.shoulder, spec.shoulderY, out.lean);
            const end = kind === 9 ? out.hands[i] : offset(out.hands[i], (wristAnchor[0] - palmAnchor[0]) * spec.hand[0],
                (wristAnchor[1] - palmAnchor[1]) * spec.hand[1], out.handAngles[i]);
            // The rear tool arm folds away from the grip so its elbow clears the front arm.
            return { start, end, ik: solve(start, end, ...spec.arm, kind === 9 ? sign : 1) };
        });
        out.legs = [-1, 1].map(sign => {
            const start = { x: out.hipX + sign * spec.hip, y: out.hipY + 2 };
            const end = { x: sign * spec.feet - sign * walk * 10, y: 4 + Math.max(0, -sign * walk) * 8 + (sign > 0 ? (out.stomp || 0) * 18 : 0) };
            return { start, end, ik: solve(start, end, ...spec.leg, sign) };
        });
        return out;
    }

    function create(parent, texture, data, kind, awake) {
        const spec = specs[kind];
        const node = new cc.Node(spec.name);
        parent.addChild(node);
        node.scale = scale;
        const cache = {}, parts = {};

        function frame(key) {
            if (!cache[key]) {
                const f = data.frames[key];
                cache[key] = new cc.SpriteFrame(texture, cc.rect(f.x, f.y, f.w, f.h));
            }
            return cache[key];
        }
        function part(name, key, size, z, ax, ay, owner = node) {
            const piece = new cc.Node(name);
            owner.addChild(piece);
            piece.setContentSize(...size);
            piece.zIndex = z;
            piece.anchorX = ax;
            piece.anchorY = ay;
            const sprite = piece.addComponent(cc.Sprite);
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = frame(key);
            parts[name] = { node: piece, sprite };
            return piece;
        }
        function limb(name, upper, lower, widths, z, boot = false) {
            const segment = new cc.Node(name + ' joint');
            node.addChild(segment);
            segment.zIndex = z;
            const top = part(name + ' upper', upper, [widths[0], 30], 0, .5, .94, segment);
            const hinge = new cc.Node(name + ' hinge');
            segment.addChild(hinge);
            const bottom = part(name + ' lower', lower, [widths[1], 30], 0, boot ? .37 : .5, .95, hinge);
            return { segment, top, hinge, bottom };
        }
        function moveLimb(limb, { start, ik }) {
            limb.segment.setPosition(start.x, start.y);
            limb.segment.angle = ik.a;
            limb.top.height = ik.l1 + 4;
            limb.hinge.setPosition(0, -ik.l1);
            limb.hinge.angle = ik.b - ik.a;
            limb.bottom.height = ik.l2 + 5;
        }
        const legs = [
            limb('Rear leg', 'thighRear', 'shinRear', spec.legWidth, 0, true),
            limb('Front leg', 'thighFront', 'shinFront', spec.legWidth, 2, true)
        ];
        const arms = [
            limb('Rear arm', 'upperRear', 'foreRear', spec.armWidth, 1),
            limb('Front arm', 'upperFront', 'foreFront', spec.armWidth, 5)
        ];
        const body = part('Body', 'torso', spec.body, 3, .5, 0);
        const head = part('Head', 'idle', spec.head, 4, spec.headX, .04, body);
        head.setPosition(1, spec.headY);
        if (kind === 9) {
            part('Spinal guard', 'tool', [24, 26], -1, .68, .5, body).setPosition(-20, 37);
        }
        const tool = kind === 9 ? null : kind === 10
            ? part('Bone horn', 'tool', [64, 53], 6, .04, .63)
            : part(kind === 8 ? 'Rift chisel' : 'Support pillar', 'tool', kind === 8 ? [26, 78] : [46, 88], 6, .5, .97);
        const handAnchor = kind === 9 ? clawAnchor : palmAnchor;
        const hands = [
            part('Rear hand', 'handRear', spec.hand, kind >= 10 ? 5 : 7, ...handAnchor),
            part('Front hand', 'handFront', spec.hand, 8, ...handAnchor)
        ];
        const marks = new cc.Node('Work and awakening accents');
        node.addChild(marks);
        marks.zIndex = 9;
        const fx = marks.addComponent(cc.Graphics);

        const rig = {
            node, kind, parts, awake: !!awake, contact: null, pose: null, face: null,
            update(work, time, rest, hit, tint) {
                const p = pose(kind, work, time, rest, hit);
                this.pose = p;
                body.setPosition(p.hipX, p.hipY);
                body.angle = p.lean;
                head.angle = p.headAngle;
                if (p.face !== this.face) {
                    parts.Head.sprite.spriteFrame = frame(p.face);
                    this.face = p.face;
                }
                arms.forEach((arm, i) => moveLimb(arm, p.arms[i]));
                legs.forEach((leg, i) => moveLimb(leg, p.legs[i]));
                if (tool) {
                    tool.setPosition(p.toolX, p.toolY);
                    tool.angle = p.toolAngle;
                }
                hands.forEach((hand, i) => {
                    hand.setPosition(p.hands[i].x, p.hands[i].y);
                    hand.angle = p.handAngles[i];
                });
                if (tint) Object.values(parts).forEach(piece => { piece.node.color = tint; });
                this.contact = { x: p.contact.x * scale, y: p.contact.y * scale };
                fx.clear();
                if (p.voice > .05) {
                    fx.strokeColor = new cc.Color(201, 226, 167, Math.round(p.voice * 200));
                    fx.lineWidth = 1.6;
                    for (let i = 0; i < 3; i++) {
                        const x = p.contact.x + 8 + i * 8, y = p.contact.y, spread = 8 + i * 3;
                        fx.moveTo(x, y - spread);
                        fx.lineTo(x + 4, y);
                        fx.lineTo(x, y + spread);
                        fx.stroke();
                    }
                }
                if (awake) {
                    fx.strokeColor = new cc.Color(167, 240, 163, 154 + Math.round(Math.sin(time * 3) * 30));
                    fx.lineWidth = 1.5;
                    for (const side of [-1, 1]) {
                        const x = side * (kind === 11 ? 46 : 31), y = p.hipY + 20;
                        fx.moveTo(x, y);
                        fx.lineTo(x + side * 6, y + 8);
                        fx.lineTo(x + side * 2, y + 15);
                        fx.stroke();
                    }
                }
                return p;
            }
        };
        rig.update({ phase: 'idle' }, 0, 0, 0);
        return rig;
    }

    const api = { specs, pose, create, palette };
    if (typeof module !== 'undefined') module.exports = api;
    root.WZInfernalWorkerRig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
