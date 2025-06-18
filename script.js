const { Engine, Render, Runner, World, Bodies, Events, Body, Composite } = Matter;

const engine = Engine.create();
const world = engine.world;
const width = window.innerWidth;
const height = window.innerHeight;

const ballImages = Array.from({ length: 11 }, (_, i) => `imgs_webp/${i + 1}.webp`);
const ballSizes = [30, 40, 50, 60, 70, 80, 100, 120, 140, 170, 200];
const mergeSounds = Array.from({ length: 8 }, (_, i) => new Audio(`sounds/${i + 1}.mp3`));

const clickSound = new Audio("sounds/click.mp3");
const breadSound = new Audio("sounds/bread.mp3");

let mergeStreak = 0;
let lastMergeTime = 0;
const mergeResetTimeout = 1000;

let score = 0;
let unlockedLevel = 1;
let nextBallLevel = weightedRandomLevel();  // 改为权重函数
let mouseX = width / 2;
let canDrop = true;
let prevPreviewSize = 0;

const render = Render.create({
    engine: engine,
    canvas: document.getElementById("world"),
    options: {
        width: width,
        height: height,
        wireframes: false,
        background: "#fdf6e3"
    }
});
Render.run(render);
Runner.run(Runner.create(), engine);

World.add(world, [
    Bodies.rectangle(width / 2, height + 20, width, 40, { isStatic: true }),
    Bodies.rectangle(-20, height / 2, 40, height, { isStatic: true }),
    Bodies.rectangle(width + 20, height / 2, 40, height, { isStatic: true })
]);

function weightedRandomLevel() {
    const levels = [0, 1, 2, 3, 4, 5];
    const weights = [5, 15, 25, 25, 25, 5];
    const total = weights.reduce((a, b) => a + b, 0);
    const r = Math.random() * total;
    let sum = 0;
    for (let i = 0; i < levels.length; i++) {
        sum += weights[i];
        if (r < sum) return levels[i];
    }
    return levels[levels.length - 1]; // fallback
}

function createBall(x, y = 0, level) {
    const radius = ballSizes[level];
    const img = ballImages[level];
    return Bodies.circle(x, y, radius, {
        restitution: 0.4,
        label: `ball-${level}`,
        render: {
            sprite: {
                texture: img,
                xScale: (radius * 2) / 128,
                yScale: (radius * 2) / 128
            }
        },
        level: level
    });
}

function drawPreview(xPos) {
    const canvas = document.getElementById("preview");
    const ctx = canvas.getContext("2d");
    const radius = ballSizes[nextBallLevel];
    const size = radius * 2;

    if (size !== prevPreviewSize) {
        canvas.width = size;
        canvas.height = size;
        prevPreviewSize = size;
    }

    canvas.style.left = `${xPos}px`;

    const img = new Image();
    img.src = ballImages[nextBallLevel];
    img.onload = () => {
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.beginPath();
        ctx.arc(radius, radius, radius, 0, 2 * Math.PI);
        ctx.clip();
        ctx.drawImage(img, 0, 0, size, size);
        ctx.restore();
    };
}

drawPreview(mouseX);

document.addEventListener("mousemove", (e) => {
    mouseX = Math.max(ballSizes[nextBallLevel], Math.min(width - ballSizes[nextBallLevel], e.clientX));
    drawPreview(mouseX);
});

document.addEventListener("click", (e) => {
    if (!canDrop || e.clientY < 100) return;
    canDrop = false;
    setTimeout(() => canDrop = true, 500);

    const level = nextBallLevel;
    nextBallLevel = weightedRandomLevel();  // 改为权重函数
    drawPreview(mouseX);

    const ball = createBall(mouseX, 0, level);
    Body.setVelocity(ball, { x: 0, y: 0 });
    World.add(world, ball);

    clickSound.currentTime = 0;
    clickSound.play();

    Events.on(engine, "collisionStart", event => {
        event.pairs.forEach(({ bodyA, bodyB }) => {
            [bodyA, bodyB].forEach(body => {
                if (body === ball && !body.settled) {
                    const other = body === bodyA ? bodyB : bodyA;
                    if (!other.isStatic || (other.position.x > 0 && other.position.x < width)) {
                        body.settled = true;
                    }
                }
            });
        });
    });
});

let merging = false;
Events.on(engine, "collisionStart", (event) => {
    if (merging) return;
    event.pairs.forEach(({ bodyA, bodyB }) => {
        if (
            bodyA.label === bodyB.label &&
            bodyA.label.startsWith("ball") &&
            !bodyA.merged && !bodyB.merged
        ) {
            const level = bodyA.level;
            if (level < 10) {
                bodyA.merged = bodyB.merged = true;
                merging = true;

                const x = (bodyA.position.x + bodyB.position.x) / 2;
                const y = (bodyA.position.y + bodyB.position.y) / 2;

                setTimeout(() => {
                    World.remove(world, bodyA);
                    World.remove(world, bodyB);
                    bodyA.render.sprite = null;
                    bodyB.render.sprite = null;

                    const newBall = createBall(x, y, level + 1);
                    Body.setVelocity(newBall, { x: 0, y: 0 });
                    Body.setPosition(newBall, { x, y });
                    World.add(world, newBall);

                    score += (level + 1) * 10;
                    const scoreElement = document.getElementById("score");
                    scoreElement.textContent = `${score}`;

                    // 添加缩放动画
                    scoreElement.style.transform = 'translateX(-50%) scale(0.85)';
                    setTimeout(() => {
                        scoreElement.style.transform = 'translateX(-50%) scale(1)';
                    }, 100);

                    const now = Date.now();
                    if (now - lastMergeTime < mergeResetTimeout) {
                        mergeStreak++;
                    } else {
                        mergeStreak = 0;
                    }
                    lastMergeTime = now;

                    if (newBall.level === 11) {
                        breadSound.currentTime = 0;
                        breadSound.play();
                    } else {
                        const sound = mergeSounds[Math.min(mergeStreak, mergeSounds.length - 1)];
                        sound.currentTime = 0;
                        sound.play();
                    }

                    merging = false;
                }, 30);
            }
        }
    });
});

let failCheckTimer = null;
const failLineY = height * 0.1;

Events.on(render, "afterRender", () => {
    const ctx = render.context;
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.moveTo(mouseX, 100);
    ctx.lineTo(mouseX, height);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(0, failLineY);
    ctx.lineTo(width, failLineY);
    ctx.strokeStyle = "red";
    ctx.lineWidth = 2;
    ctx.stroke();
});

Events.on(engine, 'afterUpdate', () => {
    if (failCheckTimer !== null) return;
    failCheckTimer = setTimeout(() => {
        for (let body of Composite.allBodies(world)) {
            if (body.label.startsWith("ball") && body.settled) {
                const radius = ballSizes[body.level];
                const topY = body.position.y - radius;
                if (topY < failLineY) {
                    document.body.style.backgroundColor = '#ffcccc';
                    setTimeout(() => {
                        alert("臭魔星！！！");
                        location.reload();
                    }, 100);
                    break;
                }
            }
        }
        failCheckTimer = null;
    }, 500);
});

// 添加预加载函数
function preloadImages() {
    ballImages.forEach(imgUrl => {
        const img = new Image();
        img.src = imgUrl;
    });
}

// 在页面加载完成后调用预加载函数
window.addEventListener('load', preloadImages);
    failCheckTimer = null;
  }, 500);
});
