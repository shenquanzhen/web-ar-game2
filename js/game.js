// 游戏状态
const gameState = {
    markerVisible: false,
    isPlaying: false,
    cameraPermissionGranted: false
};

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
let arGameWorld; // AR游戏世界容器
let threeScene; // Three.js场景

// 等待页面加载完成
window.addEventListener('load', () => {
    console.log("页面加载完成，等待AR.js初始化...");
    
    // 请求摄像头权限
    requestCameraPermission();
    
    // 监听AR标记
    setupARListeners();
    
    // 初始化游戏
    setTimeout(init, 2000); // 延迟初始化，确保AR.js已加载
});

// 请求摄像头权限
function requestCameraPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function(stream) {
                console.log("摄像头权限已获取");
                gameState.cameraPermissionGranted = true;
                // 停止流，因为AR.js会自己处理摄像头
                stream.getTracks().forEach(track => track.stop());
            })
            .catch(function(error) {
                console.error("无法获取摄像头权限:", error);
                alert("请允许摄像头访问以使用AR功能");
            });
    } else {
        console.error("浏览器不支持getUserMedia");
        alert("您的浏览器不支持摄像头访问，请使用现代浏览器");
    }
}

// 设置AR标记监听器
function setupARListeners() {
    // 等待DOM完全加载
    document.addEventListener('DOMContentLoaded', () => {
        const hiroMarker = document.querySelector('#hiro-marker');
        if (hiroMarker) {
            console.log("找到Hiro标记元素，设置事件监听器");
            
            hiroMarker.addEventListener('markerFound', () => {
                console.log("Hiro标记被找到！");
                gameState.markerVisible = true;
                
                // 如果游戏已经开始，确保游戏元素可见
                if (gameStarted && threeScene) {
                    threeScene.visible = true;
                }
                
                // 更新UI提示
                updateMarkerStatus(true);
            });
            
            hiroMarker.addEventListener('markerLost', () => {
                console.log("Hiro标记丢失！");
                gameState.markerVisible = false;
                
                // 如果游戏已经开始，隐藏游戏元素
                if (gameStarted && threeScene) {
                    threeScene.visible = false;
                }
                
                // 更新UI提示
                updateMarkerStatus(false);
            });
        } else {
            console.error('无法找到Hiro标记元素，将在2秒后重试');
            setTimeout(() => {
                const retryMarker = document.querySelector('#hiro-marker');
                if (retryMarker) {
                    console.log("重试：找到Hiro标记元素，设置事件监听器");
                    setupMarkerListeners(retryMarker);
                } else {
                    console.error('重试后仍无法找到Hiro标记元素');
                }
            }, 2000);
        }
    });
}

// 设置标记监听器
function setupMarkerListeners(marker) {
    marker.addEventListener('markerFound', () => {
        console.log("Hiro标记被找到！");
        gameState.markerVisible = true;
        
        // 如果游戏已经开始，确保游戏元素可见
        if (gameStarted && threeScene) {
            threeScene.visible = true;
        }
        
        // 更新UI提示
        updateMarkerStatus(true);
    });
    
    marker.addEventListener('markerLost', () => {
        console.log("Hiro标记丢失！");
        gameState.markerVisible = false;
        
        // 如果游戏已经开始，隐藏游戏元素
        if (gameStarted && threeScene) {
            threeScene.visible = false;
        }
        
        // 更新UI提示
        updateMarkerStatus(false);
    });
}

// 更新标记状态UI
function updateMarkerStatus(visible) {
    const instructions = document.getElementById('instructions');
    if (instructions) {
        if (visible) {
            instructions.classList.add('marker-found');
            instructions.innerHTML = '<h2>标记已识别！</h2><p>点击"开始游戏"按钮开始游戏</p>';
        } else if (!gameStarted) {
            instructions.classList.remove('marker-found');
            instructions.innerHTML = `
                <h2>AR乒乓球游戏说明</h2>
                <p>1. 打印或在另一设备上显示<a href="https://jeromeetienne.github.io/AR.js/data/images/HIRO.jpg" target="_blank">Hiro标记</a></p>
                <p>2. 允许摄像头访问权限</p>
                <p>3. 将摄像头对准Hiro标记</p>
                <p>4. 点击"开始游戏"按钮</p>
                <p>5. 移动设备来控制游戏视角和挡板</p>
            `;
        }
    }
}

// 初始化游戏
function init() {
    console.log("初始化游戏...");
    
    // 获取AR游戏世界容器
    arGameWorld = document.querySelector('#game-world');
    if (!arGameWorld) {
        console.error('无法找到AR游戏世界容器');
        return;
    }
    
    // 设置游戏区域大小
    gameWidth = 2;
    gameHeight = 1.2;
    gameDepth = 3;
    
    // 创建Three.js场景
    createThreeScene();
    
    // 添加事件监听器
    document.getElementById('start-button').addEventListener('click', startGame);
    document.getElementById('restart-button').addEventListener('click', restartGame);
    
    // 添加设备方向控制
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    
    // 添加触摸控制
    document.addEventListener('touchstart', handleTouch, { passive: false });
    document.addEventListener('touchmove', handleTouch, { passive: false });
    
    console.log("游戏初始化完成");
}

// 创建Three.js场景
function createThreeScene() {
    console.log("创建Three.js场景...");
    
    // 创建场景
    threeScene = new THREE.Scene();
    
    // 创建游戏元素
    createGameElements();
    
    // 将Three.js场景添加到A-Frame实体
    const threeJSScene = new THREE.Object3D();
    threeJSScene.add(threeScene);
    
    // 将Three.js场景附加到A-Frame实体
    arGameWorld.object3D.add(threeJSScene);
    
    // 初始隐藏场景，直到标记被找到
    threeScene.visible = false;
    
    console.log("Three.js场景创建完成");
}

// 创建游戏元素
function createGameElements() {
    console.log("创建游戏元素...");
    
    // 创建玩家挡板
    const paddleGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.04);
    const paddleMaterial = new THREE.MeshPhongMaterial({ color: 0x1E90FF });
    paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
    paddle.position.z = gameDepth / 2 - 0.2;
    threeScene.add(paddle);

    // 创建电脑挡板
    computerPaddle = new THREE.Mesh(paddleGeometry, new THREE.MeshPhongMaterial({ color: 0xFF4500 }));
    computerPaddle.position.z = -gameDepth / 2 + 0.2;
    threeScene.add(computerPaddle);

    // 创建球
    const ballGeometry = new THREE.SphereGeometry(0.06, 32, 32);
    const ballMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF });
    ball = new THREE.Mesh(ballGeometry, ballMaterial);
    threeScene.add(ball);
    resetBall();

    // 创建游戏区域边界
    createWalls();
    
    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    threeScene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 2, 1);
    threeScene.add(directionalLight);
    
    console.log("游戏元素创建完成");
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
    const topWallGeometry = new THREE.BoxGeometry(gameWidth, 0.04, gameDepth);
    const topWall = new THREE.Mesh(topWallGeometry, wallMaterial);
    topWall.position.y = gameHeight / 2;
    threeScene.add(topWall);
    walls.push(topWall);

    // 下墙
    const bottomWallGeometry = new THREE.BoxGeometry(gameWidth, 0.04, gameDepth);
    const bottomWall = new THREE.Mesh(bottomWallGeometry, wallMaterial);
    bottomWall.position.y = -gameHeight / 2;
    threeScene.add(bottomWall);
    walls.push(bottomWall);

    // 左墙
    const leftWallGeometry = new THREE.BoxGeometry(0.04, gameHeight, gameDepth);
    const leftWall = new THREE.Mesh(leftWallGeometry, wallMaterial);
    leftWall.position.x = -gameWidth / 2;
    threeScene.add(leftWall);
    walls.push(leftWall);

    // 右墙
    const rightWallGeometry = new THREE.BoxGeometry(0.04, gameHeight, gameDepth);
    const rightWall = new THREE.Mesh(rightWallGeometry, wallMaterial);
    rightWall.position.x = gameWidth / 2;
    threeScene.add(rightWall);
    walls.push(rightWall);
}

// 处理设备方向变化
function handleDeviceOrientation(event) {
    if (!gameStarted || !gameState.markerVisible) return;
    
    // 获取设备方向数据
    const beta = event.beta;  // X轴旋转 (-180 到 180)
    const gamma = event.gamma; // Y轴旋转 (-90 到 90)
    
    // 将设备倾斜转换为挡板移动
    if (beta !== null && gamma !== null) {
        // 限制在合理范围内
        const normalizedGamma = THREE.MathUtils.clamp(gamma / 45, -1, 1);
        const normalizedBeta = THREE.MathUtils.clamp((beta - 45) / 45, -1, 1);
        
        // 更新挡板位置
        paddle.position.x = normalizedGamma * (gameWidth / 2 - 0.3);
        paddle.position.y = -normalizedBeta * (gameHeight / 2 - 0.1);
    }
}

// 处理触摸事件
function handleTouch(event) {
    if (!gameStarted || !gameState.markerVisible) return;
    event.preventDefault();
    
    if (event.touches.length > 0) {
        const touch = event.touches[0];
        
        // 将触摸位置转换为相对于屏幕中心的位置
        const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
        const touchY = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        // 更新挡板位置
        paddle.position.x = touchX * (gameWidth / 2 - 0.3);
        paddle.position.y = touchY * (gameHeight / 2 - 0.1);
    }
}

// 开始游戏
function startGame() {
    console.log("尝试开始游戏...");
    
    if (gameStarted) return;
    
    // 检查摄像头权限
    if (!gameState.cameraPermissionGranted) {
        alert("请先允许摄像头访问权限");
        requestCameraPermission();
        return;
    }
    
    // 检查标记是否可见
    if (!gameState.markerVisible) {
        alert("请先将摄像头对准Hiro标记！");
        return;
    }
    
    console.log("游戏开始！");
    gameStarted = true;
    document.getElementById('start-button').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    
    // 显示游戏场景
    if (threeScene) {
        threeScene.visible = true;
    }
    
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
    if (!ball) return;
    
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
    if (!ball) return;
    
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
    if (!computerPaddle || !ball) return;
    
    // 简单的AI：跟随球的x和y位置，但有延迟
    if (ballDirection.z < 0) { // 只有当球朝向电脑时才移动
        const targetX = ball.position.x;
        const targetY = ball.position.y;
        
        // 根据难度系数移动挡板
        computerPaddle.position.x += (targetX - computerPaddle.position.x) * difficulty;
        computerPaddle.position.y += (targetY - computerPaddle.position.y) * difficulty;
        
        // 限制挡板在游戏区域内
        computerPaddle.position.x = THREE.MathUtils.clamp(computerPaddle.position.x, -gameWidth / 2 + 0.3, gameWidth / 2 - 0.3);
        computerPaddle.position.y = THREE.MathUtils.clamp(computerPaddle.position.y, -gameHeight / 2 + 0.1, gameHeight / 2 - 0.1);
    }
}

// 动画循环
function animate() {
    animationId = requestAnimationFrame(animate);
    
    if (gameStarted && gameState.markerVisible) {
        // 更新球的位置
        if (ball) {
            ball.position.x += ballDirection.x * ballSpeed;
            ball.position.y += ballDirection.y * ballSpeed;
            ball.position.z += ballDirection.z * ballSpeed;
        }
        
        // 检测碰撞
        checkCollisions();
        
        // 更新电脑挡板
        updateComputerPaddle();
    }
} 