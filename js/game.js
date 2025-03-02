// 游戏状态
const gameState = {
    score: 0,
    timeRemaining: 60,
    isPlaying: false,
    targetCount: 0,
    maxTargets: 5,
    timer: null,
    targetColors: ['red', 'blue', 'green', 'yellow', 'purple'],
    markerVisible: false
};

// DOM元素
let startButton;
let scoreDisplay;
let timerDisplay;
let targetsContainer;
let instructions;

// 游戏变量
let scene, camera, renderer, paddle, ball, computerPaddle;
let gameStarted = false;
let playerScore = 0;
let computerScore = 0;
let ballSpeed = 0.05;
let ballDirection = new THREE.Vector3(0.5, 0.5, 0.5);
let gameContainer;
let gameWidth, gameHeight, gameDepth;
let walls = [];
let animationId = null;
let difficulty = 0.03; // 电脑AI难度系数

// 等待AR.js和A-Frame加载完成
window.addEventListener('load', () => {
    // 初始化DOM元素引用
    startButton = document.getElementById('start-button');
    scoreDisplay = document.getElementById('score');
    timerDisplay = document.getElementById('timer');
    targetsContainer = document.getElementById('targets-container');
    instructions = document.getElementById('instructions');
    
    // 初始化游戏
    init();
});

// 初始化游戏
function init() {
    if (!startButton) {
        console.error('无法找到开始按钮元素');
        return;
    }
    
    startButton.addEventListener('click', startGame);
    
    // 监听标记可见性 - Hiro标记
    const hiroMarker = document.querySelector('a-marker[preset="hiro"]');
    if (hiroMarker) {
        hiroMarker.addEventListener('markerFound', () => {
            console.log("Hiro标记被找到！");
            gameState.markerVisible = true;
            
            if (gameState.isPlaying && getTargetCount() < gameState.maxTargets) {
                // 当标记被找到时，确保有足够的目标
                const targetsToAdd = gameState.maxTargets - getTargetCount();
                for (let i = 0; i < targetsToAdd; i++) {
                    createTarget();
                }
            }
        });
        
        hiroMarker.addEventListener('markerLost', () => {
            console.log("Hiro标记丢失！");
            gameState.markerVisible = false;
        });
    } else {
        console.error('无法找到Hiro标记元素');
    }
    
    // 添加点击事件监听器
    document.addEventListener('click', (event) => {
        if (!gameState.isPlaying) return;
        
        // 检查是否点击了目标
        const element = event.target;
        if (element.classList.contains('target')) {
            // 增加分数
            gameState.score += 10;
            updateScore();
            
            // 移除目标
            if (element.parentNode) {
                element.parentNode.removeChild(element);
                gameState.targetCount--;
                
                // 生成新目标
                setTimeout(() => {
                    if (gameState.isPlaying && gameState.markerVisible) {
                        createTarget();
                    }
                }, 500);
            }
        }
    });

    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // 天蓝色背景

    // 设置游戏区域大小
    gameWidth = 10;
    gameHeight = 6;
    gameDepth = 15;

    // 创建相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = gameDepth + 5;
    camera.position.y = 2;
    camera.lookAt(0, 0, 0);

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    gameContainer = document.getElementById('game-container');
    gameContainer.appendChild(renderer.domElement);

    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 10, 5);
    scene.add(directionalLight);

    // 创建游戏元素
    createGameElements();

    // 添加事件监听器
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', restartGame);

    // 初始渲染
    renderer.render(scene, camera);
}

// 创建游戏元素
function createGameElements() {
    // 创建玩家挡板
    const paddleGeometry = new THREE.BoxGeometry(3, 1, 0.2);
    const paddleMaterial = new THREE.MeshPhongMaterial({ color: 0x1E90FF });
    paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    paddle.position.z = gameDepth / 2 - 1;
    scene.add(paddle);

    // 创建电脑挡板
    computerPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshPhongMaterial({ color: 0xFF4500 }));
    computerPaddle.position.z = -gameDepth / 2 + 1;
    scene.add(computerPaddle);

    // 创建球
    const ballGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    scene.add(ball);
    resetBall();

    // 创建游戏区域边界
    createWalls();
}

// 创建游戏区域边界
function createWalls() {
    // 材质 - 半透明
    const wallMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xAAAAAA, 
        transparent: true, 
        opacity: 0.2 
    });

    // 上墙
    const topWallGeometry = new THREE.BoxGeometry(gameWidth, 0.2, gameDepth);
    const topWall = new THREE.Mesh(topWallGeometry, wallMaterial);
    topWall.position.y = gameHeight / 2;
    scene.add(topWall);
    walls.push(topWall);

    // 下墙
    const bottomWallGeometry = new THREE.BoxGeometry(gameWidth, 0.2, gameDepth);
    const bottomWall = new THREE.Mesh(bottomWallGeometry, wallMaterial);
    bottomWall.position.y = -gameHeight / 2;
    scene.add(bottomWall);
    walls.push(bottomWall);

    // 左墙
    const leftWallGeometry = new THREE.BoxGeometry(0.2, gameHeight, gameDepth);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.x = -gameWidth / 2;
    scene.add(leftWall);
    walls.push(leftWall);

    // 右墙
    const rightWallGeometry = new THREE.BoxGeometry(0.2, gameHeight, gameDepth);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.x = gameWidth / 2;
    scene.add(rightWall);
    walls.push(rightWall);
}

// 窗口大小调整
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// 鼠标移动控制挡板
function onMouseMove(event) {
    if (!gameStarted) return;
    
    // 将鼠标位置转换为游戏坐标
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // 限制挡板在游戏区域内
    paddle.position.x = THREE.MathUtils.clamp(mouseX * (gameWidth / 2), -gameWidth / 2 + 1.5, gameWidth / 2 - 1.5);
    paddle.position.y = THREE.MathUtils.clamp(mouseY * (gameHeight / 2), -gameHeight / 2 + 0.5, gameHeight / 2 - 0.5);
}

// 触摸移动控制挡板
function onTouchMove(event) {
    if (!gameStarted) return;
    event.preventDefault();
    
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
        const touchY = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        // 限制挡板在游戏区域内
        paddle.position.x = THREE.MathUtils.clamp(touchX * (gameWidth / 2), -gameWidth / 2 + 1.5, gameWidth / 2 - 1.5);
        paddle.position.y = THREE.MathUtils.clamp(touchY * (gameHeight / 2), -gameHeight / 2 + 0.5, gameHeight / 2 - 0.5);
    }
}

// 开始游戏
function startGame() {
    if (gameStarted) return;
    
    gameStarted = true;
    document.getElementById('start-button').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    
    // 重置球的位置和方向
    resetBall();
    
    // 开始游戏循环
    animate();
}

// 重新开始游戏
function restartGame() {
    playerScore = 0;
    computerScore = 0;
    updateScore();
    
    document.getElementById('game-over').style.display = 'none';
    
    resetBall();
    gameStarted = true;
    
    // 重新开始动画循环
    if (animationId === null) {
        animate();
    }
}

// 重置球的位置和方向
function resetBall() {
    ball.position.set(0, 0, 0);
    
    // 随机方向，确保x和z方向有足够的速度
    const angle = Math.random() * Math.PI * 2;
    const zDirection = Math.random() > 0.5 ? 1 : -1;
    
    ballDirection.x = Math.cos(angle) * 0.7;
    ballDirection.y = Math.sin(angle) * 0.7;
    ballDirection.z = zDirection * 0.7;
    
    // 确保方向向量是单位向量
    ballDirection.normalize();
}

// 更新分数显示
function updateScore() {
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('computer-score').textContent = computerScore;
}

// 游戏结束
function gameOver(winner) {
    gameStarted = false;
    
    const gameOverElement = document.getElementById('game-over');
    const resultElement = document.getElementById('game-result');
    
    if (winner === 'player') {
        resultElement.textContent = '恭喜你赢了！';
    } else {
        resultElement.textContent = '电脑赢了，再试一次！';
    }
    
    gameOverElement.style.display = 'block';
    
    // 停止动画循环
    cancelAnimationFrame(animationId);
    animationId = null;
}

// 检测碰撞
function checkCollisions() {
    // 与墙壁的碰撞
    if (ball.position.x + ball.geometry.parameters.radius > gameWidth / 2 || 
        ball.position.x - ball.geometry.parameters.radius < -gameWidth / 2) {
        ballDirection.x *= -1;
    }
    
    if (ball.position.y + ball.geometry.parameters.radius > gameHeight / 2 || 
        ball.position.y - ball.geometry.parameters.radius < -gameHeight / 2) {
        ballDirection.y *= -1;
    }
    
    // 与玩家挡板的碰撞
    if (ball.position.z + ball.geometry.parameters.radius > paddle.position.z - paddle.geometry.parameters.depth / 2 &&
        ball.position.z - ball.geometry.parameters.radius < paddle.position.z + paddle.geometry.parameters.depth / 2 &&
        ball.position.x + ball.geometry.parameters.radius > paddle.position.x - paddle.geometry.parameters.width / 2 &&
        ball.position.x - ball.geometry.parameters.radius < paddle.position.x + paddle.geometry.parameters.width / 2 &&
        ball.position.y + ball.geometry.parameters.radius > paddle.position.y - paddle.geometry.parameters.height / 2 &&
        ball.position.y - ball.geometry.parameters.radius < paddle.position.y + paddle.geometry.parameters.height / 2) {
        
        // 反弹方向基于击中挡板的位置
        const hitPosition = (ball.position.x - paddle.position.x) / (paddle.geometry.parameters.width / 2);
        ballDirection.x = hitPosition * 0.8;
        ballDirection.y = (ball.position.y - paddle.position.y) / (paddle.geometry.parameters.height / 2) * 0.5;
        ballDirection.z *= -1;
        
        // 确保方向向量是单位向量
        ballDirection.normalize();
        
        // 增加球速
        ballSpeed += 0.002;
    }
    
    // 与电脑挡板的碰撞
    if (ball.position.z + ball.geometry.parameters.radius > computerPaddle.position.z - computerPaddle.geometry.parameters.depth / 2 &&
        ball.position.z - ball.geometry.parameters.radius < computerPaddle.position.z + computerPaddle.geometry.parameters.depth / 2 &&
        ball.position.x + ball.geometry.parameters.radius > computerPaddle.position.x - computerPaddle.geometry.parameters.width / 2 &&
        ball.position.x - ball.geometry.parameters.radius < computerPaddle.position.x + computerPaddle.geometry.parameters.width / 2 &&
        ball.position.y + ball.geometry.parameters.radius > computerPaddle.position.y - computerPaddle.geometry.parameters.height / 2 &&
        ball.position.y - ball.geometry.parameters.radius < computerPaddle.position.y + computerPaddle.geometry.parameters.height / 2) {
        
        // 反弹方向基于击中挡板的位置
        const hitPosition = (ball.position.x - computerPaddle.position.x) / (computerPaddle.geometry.parameters.width / 2);
        ballDirection.x = hitPosition * 0.8;
        ballDirection.y = (ball.position.y - computerPaddle.position.y) / (computerPaddle.geometry.parameters.height / 2) * 0.5;
        ballDirection.z *= -1;
        
        // 确保方向向量是单位向量
        ballDirection.normalize();
    }
    
    // 检查是否有人得分
    if (ball.position.z > gameDepth / 2) {
        // 电脑得分
        computerScore++;
        updateScore();
        
        if (computerScore >= 5) {
            gameOver('computer');
        } else {
            resetBall();
        }
    } else if (ball.position.z < -gameDepth / 2) {
        // 玩家得分
        playerScore++;
        updateScore();
        
        if (playerScore >= 5) {
            gameOver('player');
        } else {
            resetBall();
        }
    }
}

// 更新电脑挡板位置
function updateComputerPaddle() {
    // 简单的AI：跟随球的x和y位置，但有延迟
    if (ballDirection.z < 0) { // 只有当球朝向电脑时才移动
        const targetX = ball.position.x;
        const targetY = ball.position.y;
        
        // 根据难度系数移动挡板
        computerPaddle.position.x += (targetX - computerPaddle.position.x) * difficulty;
        computerPaddle.position.y += (targetY - computerPaddle.position.y) * difficulty;
        
        // 限制挡板在游戏区域内
        computerPaddle.position.x = THREE.MathUtils.clamp(computerPaddle.position.x, -gameWidth / 2 + 1.5, gameWidth / 2 - 1.5);
        computerPaddle.position.y = THREE.MathUtils.clamp(computerPaddle.position.y, -gameHeight / 2 + 0.5, gameHeight / 2 - 0.5);
    }
}

// 动画循环
function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (gameStarted) {
        // 更新球的位置
        ball.position.x += ballDirection.x * ballSpeed;
        ball.position.y += ballDirection.y * ballSpeed;
        ball.position.z += ballDirection.z * ballSpeed;
        
        // 检测碰撞
        checkCollisions();
        
        // 更新电脑挡板
        updateComputerPaddle();
    }
    
    // 渲染场景
    renderer.render(scene, camera);
}

// 创建目标
function createTarget() {
    if (!targetsContainer || getTargetCount() >= gameState.maxTargets || !gameState.markerVisible) return;
    
    // 创建一个随机颜色的球体
    const targetEntity = document.createElement('a-entity');
    const colorIndex = Math.floor(Math.random() * gameState.targetColors.length);
    const color = gameState.targetColors[colorIndex];
    
    // 随机位置（相对于标记）
    const x = (Math.random() - 0.5) * 1.5;
    const y = (Math.random() - 0.5) * 1.5 + 0.5; // 稍微抬高一点
    const z = (Math.random() - 0.5) * 1.5;
    
    targetEntity.setAttribute('geometry', 'primitive: sphere; radius: 0.2');
    targetEntity.setAttribute('material', `color: ${color}; shader: flat`);
    targetEntity.setAttribute('position', `${x} ${y} ${z}`);
    targetEntity.setAttribute('class', 'target');
    targetEntity.setAttribute('animation', 'property: position; to: ' + 
                             `${x + (Math.random() - 0.5)} ${y + (Math.random() - 0.5) * 0.5} ${z}; ` +
                             'dur: 2000; easing: easeInOutQuad; loop: true; dir: alternate');
    
    // 添加到场景
    targetsContainer.appendChild(targetEntity);
    gameState.targetCount++;
}

// 获取当前目标数量
function getTargetCount() {
    return targetsContainer ? targetsContainer.childNodes.length : 0;
}

// 更新计时器显示
function updateTimer() {
    if (timerDisplay) {
        timerDisplay.textContent = `时间: ${gameState.timeRemaining}`;
    }
} 