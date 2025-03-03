// 游戏状态
const gameState = {
    markerVisible: false,
    isPlaying: false,
    cameraPermissionGranted: false,
    bypassMarkerDetection: true, // 新增：绕过标记检测
    isMobile: false, // 新增：移动设备标志
    arInitialized: false, // 新增：AR初始化状态
    deviceMotionEnabled: false, // 新增：设备运动检测状态
    lastAcceleration: { x: 0, y: 0, z: 0 }, // 新增：上一次加速度值
    gameWorldDistance: -3, // 新增：游戏世界距离
    gameWorldScale: 0.5, // 新增：游戏世界缩放比例
    gameWorldRotation: { x: 0, y: 0, z: 0 }, // 新增：游戏世界旋转角度
    lastDeviceOrientation: { alpha: 0, beta: 0, gamma: 0 }, // 新增：上一次设备方向
    deviceOrientationEnabled: false // 新增：设备方向检测状态
};

// 游戏变量
let scene, camera, renderer, paddle, ball, computerPaddle;
let gameStarted = false;
let playerScore = 0;
let computerScore = 0;
let ballSpeed = 0.05;
let ballDirection = new THREE.Vector3(0.5, 0.5, 0.5);
let gameContainer;
let gameWidth = 2; // 游戏区域宽度
let gameHeight = 1.2; // 游戏区域高度
let gameDepth = 3; // 游戏区域深度
let walls = [];
let animationId = null;
let difficulty = 0.03; // 电脑AI难度系数
let arGameWorld; // AR游戏世界容器
let threeScene; // Three.js场景
let arInitRetries = 0; // AR初始化重试次数
const MAX_AR_INIT_RETRIES = 3; // 最大重试次数

// 等待页面加载完成
window.addEventListener('load', () => {
    console.log("页面加载完成，等待AR.js初始化...");
    
    // 检测设备类型
    checkDeviceType();
    
    // 请求摄像头权限
    requestCameraPermission();
    
    // 监听AR标记
    setupARListeners();
    
    // 添加AR错误处理
    setupARErrorHandling();
    
    // 设置设备运动检测
    setupDeviceMotionDetection();
    
    // 设置设备方向检测
    setupDeviceOrientationDetection();
    
    // 设置手势缩放功能
    setupPinchZoom();
    
    // 初始化游戏
    setTimeout(init, 2000); // 延迟初始化，确保AR.js已加载
});

// 检测设备类型
function checkDeviceType() {
    // 检测是否为移动设备
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    console.log("设备类型: " + (isMobile ? "移动设备" : "桌面设备"));
    
    if (isMobile) {
        // 移动设备特定设置
        gameState.isMobile = true;
        
        // 在移动设备上，调整游戏世界位置
        const gameWorld = document.querySelector('#game-world');
        if (gameWorld) {
            // 将游戏世界放置在更靠近摄像机的位置
            gameWorld.setAttribute('position', '0 0 -2');
            gameWorld.setAttribute('scale', '0.3 0.3 0.3');
        }
    }
}

// 请求摄像头权限
function requestCameraPermission() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 640 },
                height: { ideal: 480 }
            } 
        })
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

// 设置AR错误处理
function setupARErrorHandling() {
    // 监听AR.js可能的错误
    window.addEventListener('artoolkit-camera-error', function(event) {
        console.error('AR.js摄像头错误:', event);
        handleARError('camera');
    });
    
    window.addEventListener('artoolkit-marker-error', function(event) {
        console.error('AR.js标记错误:', event);
        handleARError('marker');
    });
    
    // 监听AR场景加载完成
    document.addEventListener('arjs-video-loaded', function() {
        console.log('AR.js视频加载完成');
        gameState.arInitialized = true;
    });
    
    // 监听AR场景加载错误
    document.addEventListener('arjs-video-error', function(error) {
        console.error('AR.js视频加载错误:', error);
        handleARError('video');
    });
}

// 处理AR错误
function handleARError(errorType) {
    console.log(`处理AR错误: ${errorType}`);
    
    if (arInitRetries < MAX_AR_INIT_RETRIES) {
        arInitRetries++;
        console.log(`AR初始化重试 ${arInitRetries}/${MAX_AR_INIT_RETRIES}`);
        
        // 尝试重新初始化AR
        setTimeout(() => {
            // 重新加载AR场景
            const arScene = document.querySelector('a-scene');
            if (arScene) {
                arScene.reload();
            }
        }, 1000);
    } else {
        console.log('AR初始化失败次数过多，强制绕过标记检测');
        // 强制绕过标记检测
        gameState.bypassMarkerDetection = true;
        
        // 更新UI提示
        updateMarkerStatus(false);
        
        // 确保游戏可以开始
        if (threeScene) {
            threeScene.visible = true;
        }
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
                if (gameStarted && threeScene && !gameState.bypassMarkerDetection) {
                    threeScene.visible = true;
                }
                
                // 更新UI提示
                updateMarkerStatus(true);
            });
            
            hiroMarker.addEventListener('markerLost', () => {
                console.log("Hiro标记丢失！");
                gameState.markerVisible = false;
                
                // 如果游戏已经开始，且不绕过标记检测，则隐藏游戏元素
                if (gameStarted && threeScene && !gameState.bypassMarkerDetection) {
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
                    // 如果仍然找不到标记，强制绕过标记检测
                    gameState.bypassMarkerDetection = true;
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
        if (gameStarted && threeScene && !gameState.bypassMarkerDetection) {
            threeScene.visible = true;
        }
        
        // 更新UI提示
        updateMarkerStatus(true);
    });
    
    marker.addEventListener('markerLost', () => {
        console.log("Hiro标记丢失！");
        gameState.markerVisible = false;
        
        // 如果游戏已经开始，且不绕过标记检测，则隐藏游戏元素
        if (gameStarted && threeScene && !gameState.bypassMarkerDetection) {
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
            
            // 根据是否绕过标记检测显示不同的提示
            if (gameState.bypassMarkerDetection) {
                instructions.innerHTML = `
                    <h2>AR乒乓球游戏说明</h2>
                    <p>1. 允许摄像头访问权限</p>
                    <p>2. 点击"开始游戏"按钮</p>
                    <p>3. 移动设备或触摸屏幕来控制挡板</p>
                    <p>4. 如果有Hiro标记，可以将其放在摄像头前增强AR体验</p>
                `;
            } else {
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
}

// 初始化游戏
function init() {
    console.log("初始化游戏...");
    
    // 设置游戏世界初始变换
    gameState.gameWorldDistance = -3;
    gameState.gameWorldRotation = { x: 0, y: 0, z: 0 };
    gameState.gameWorldScale = 0.5;
    updateGameWorldTransform();
    
    // 创建Three.js场景
    createThreeScene();
    
    // 创建游戏元素
    createGameElements();
    
    // 添加事件监听器
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchstart', handleTouch, { passive: false });
    
    // 添加开始游戏按钮事件监听器
    document.getElementById('start-button').addEventListener('click', startGame);
    
    // 添加重新开始按钮事件监听器
    document.getElementById('restart-button').addEventListener('click', restartGame);
    
    // 添加AR相关提示
    const instructions = document.getElementById('instructions');
    if (instructions) {
        const arTip = document.createElement('p');
        arTip.innerHTML = '提示: 移动设备可以围绕游戏空间查看不同角度，双指捏合可以缩放，双指旋转可以旋转游戏空间';
        arTip.style.color = '#FFFF00';
        instructions.appendChild(arTip);
    }
}

// 创建Three.js场景
function createThreeScene() {
    console.log("创建Three.js场景...");
    
    // 获取AR游戏世界容器
    arGameWorld = document.querySelector('#game-world');
    if (!arGameWorld) {
        console.error('无法找到AR游戏世界容器');
        return;
    }
    
    // 创建场景
    threeScene = new THREE.Scene();
    
    // 将Three.js场景添加到A-Frame实体
    const threeJSScene = new THREE.Object3D();
    threeJSScene.add(threeScene);
    
    // 将Three.js场景附加到A-Frame实体
    arGameWorld.object3D.add(threeJSScene);
    
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
    // 创建网格材质 - 蓝色科幻风格
    const gridTexture = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');
    const gridMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x00BFFF, 
        transparent: true, 
        opacity: 0.6,
        wireframe: true,
        wireframeLinewidth: 2
    });
    
    // 创建辅助网格线材质
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x0088FF, 
        transparent: true, 
        opacity: 0.8 
    });
    
    // 上墙
    const topWallGeometry = new THREE.BoxGeometry(gameWidth, 0.04, gameDepth, 10, 1, 10);
    const topWall = new THREE.Mesh(topWallGeometry, gridMaterial);
    topWall.position.y = gameHeight / 2;
    threeScene.add(topWall);
    walls.push(topWall);
    
    // 添加上墙网格线
    const topEdges = new THREE.EdgesGeometry(topWallGeometry);
    const topLine = new THREE.LineSegments(topEdges, lineMaterial);
    topLine.position.copy(topWall.position);
    threeScene.add(topLine);

    // 下墙
    const bottomWallGeometry = new THREE.BoxGeometry(gameWidth, 0.04, gameDepth, 10, 1, 10);
    const bottomWall = new THREE.Mesh(bottomWallGeometry, gridMaterial);
    bottomWall.position.y = -gameHeight / 2;
    threeScene.add(bottomWall);
    walls.push(bottomWall);
    
    // 添加下墙网格线
    const bottomEdges = new THREE.EdgesGeometry(bottomWallGeometry);
    const bottomLine = new THREE.LineSegments(bottomEdges, lineMaterial);
    bottomLine.position.copy(bottomWall.position);
    threeScene.add(bottomLine);

    // 左墙
    const leftWallGeometry = new THREE.BoxGeometry(0.04, gameHeight, gameDepth, 1, 10, 10);
    const leftWall = new THREE.Mesh(leftWallGeometry, gridMaterial);
    leftWall.position.x = -gameWidth / 2;
    threeScene.add(leftWall);
    walls.push(leftWall);
    
    // 添加左墙网格线
    const leftEdges = new THREE.EdgesGeometry(leftWallGeometry);
    const leftLine = new THREE.LineSegments(leftEdges, lineMaterial);
    leftLine.position.copy(leftWall.position);
    threeScene.add(leftLine);

    // 右墙
    const rightWallGeometry = new THREE.BoxGeometry(0.04, gameHeight, gameDepth, 1, 10, 10);
    const rightWall = new THREE.Mesh(rightWallGeometry, gridMaterial);
    rightWall.position.x = gameWidth / 2;
    threeScene.add(rightWall);
    walls.push(rightWall);
    
    // 添加右墙网格线
    const rightEdges = new THREE.EdgesGeometry(rightWallGeometry);
    const rightLine = new THREE.LineSegments(rightEdges, lineMaterial);
    rightLine.position.copy(rightWall.position);
    threeScene.add(rightLine);
    
    // 添加边界指示线 - 前后边界
    const frontBoundaryGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(gameWidth, gameHeight, 0.01));
    const frontBoundary = new THREE.LineSegments(frontBoundaryGeometry, new THREE.LineBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.4 }));
    frontBoundary.position.z = -gameDepth / 2;
    threeScene.add(frontBoundary);
    
    const backBoundaryGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(gameWidth, gameHeight, 0.01));
    const backBoundary = new THREE.LineSegments(backBoundaryGeometry, new THREE.LineBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.4 }));
    backBoundary.position.z = gameDepth / 2;
    threeScene.add(backBoundary);
    
    // 添加环境光晕效果
    const ambientLight = new THREE.AmbientLight(0x404040);
    threeScene.add(ambientLight);
    
    // 添加方向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 1, 1).normalize();
    threeScene.add(directionalLight);
    
    // 添加点光源
    const pointLight = new THREE.PointLight(0x00BFFF, 1, 10);
    pointLight.position.set(0, 0, 0);
    threeScene.add(pointLight);
}

// 处理设备方向变化
function handleDeviceOrientation(event) {
    // 移除对标记可见性的检查，只检查游戏是否已开始
    if (!gameStarted) return;
    
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

// 处理触摸事件 - 修改为支持游戏空间调整
function handleTouch(event) {
    // 移除对标记可见性的检查，只检查游戏是否已开始
    if (!gameStarted) return;
    
    // 如果是双指触摸，不处理挡板移动（由缩放功能处理）
    if (event.touches.length === 2) return;
    
    event.preventDefault();
    
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        
        // 将触摸位置转换为相对于屏幕中心的位置
        const touchX = (touch.clientX / window.innerWidth) * 2 - 1;
        const touchY = -(touch.clientY / window.innerHeight) * 2 + 1;
        
        // 更新挡板位置
        paddle.position.x = touchX * (gameWidth / 2 - 0.3);
        paddle.position.y = touchY * (gameHeight / 2 - 0.1);
        
        // 添加调试日志
        console.log("触摸控制: ", touchX, touchY, "挡板位置: ", paddle.position.x, paddle.position.y);
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
    
    // 检查标记是否可见（如果不绕过标记检测）
    if (!gameState.markerVisible && !gameState.bypassMarkerDetection) {
        alert("请先将摄像头对准Hiro标记！");
        return;
    }
    
    console.log("游戏开始！");
    gameStarted = true;
    document.getElementById('start-button').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    
    // 显示游戏场景，无论标记是否可见
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
    
    // 与左右墙壁的碰撞
    if (ball.position.x + ball.geometry.parameters.radius > gameWidth / 2 || 
        ball.position.x - ball.geometry.parameters.radius < -gameWidth / 2) {
        ballDirection.x *= -1;
    }
    
    // 与上下墙壁的碰撞
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
    
    // 检查是否有人得分 - 球超出前后边界
    if (ball.position.z > gameDepth / 2 + ball.geometry.parameters.radius) {
        // 电脑得分
        computerScore++;
        updateScore();
        
        if (computerScore >= 5) {
            gameOver('computer');
        } else {
            resetBall();
        }
    } else if (ball.position.z < -gameDepth / 2 - ball.geometry.parameters.radius) {
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
    
    // 修改条件：即使标记不可见也继续游戏
    if (gameStarted && (gameState.markerVisible || gameState.bypassMarkerDetection)) {
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

// 设置设备运动检测
function setupDeviceMotionDetection() {
    // 检查设备是否支持DeviceMotionEvent
    if (window.DeviceMotionEvent) {
        console.log("设备支持运动检测");
        
        // 对于iOS 13+，需要请求权限
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            // 添加按钮请求权限 - 与方向检测共用一个按钮
            const motionButton = document.getElementById('motion-permission-button') || document.createElement('button');
            motionButton.id = 'motion-permission-button';
            motionButton.innerText = '启用设备运动和方向检测';
            motionButton.style.position = 'absolute';
            motionButton.style.bottom = '10px';
            motionButton.style.left = '10px';
            motionButton.style.zIndex = '100';
            motionButton.style.padding = '8px';
            motionButton.style.backgroundColor = '#4CAF50';
            motionButton.style.color = 'white';
            motionButton.style.border = 'none';
            motionButton.style.borderRadius = '4px';
            
            // 如果已经设置了方向检测按钮，不需要再添加事件监听器
            if (!document.getElementById('motion-permission-button')) {
                motionButton.addEventListener('click', () => {
                    Promise.all([
                        DeviceMotionEvent.requestPermission(),
                        typeof DeviceOrientationEvent.requestPermission === 'function' 
                            ? DeviceOrientationEvent.requestPermission() 
                            : Promise.resolve('granted')
                    ])
                    .then(responses => {
                        if (responses[0] === 'granted') {
                            gameState.deviceMotionEnabled = true;
                            window.addEventListener('devicemotion', handleDeviceMotion);
                            
                            if (responses[1] === 'granted') {
                                gameState.deviceOrientationEnabled = true;
                                window.addEventListener('deviceorientation', handleDeviceOrientationForGameWorld);
                            }
                            
                            motionButton.style.display = 'none';
                            console.log("设备运动和方向检测权限已获取");
                        }
                    })
                    .catch(console.error);
                });
                
                document.body.appendChild(motionButton);
            }
        } else {
            // 非iOS设备，直接添加监听器
            gameState.deviceMotionEnabled = true;
            window.addEventListener('devicemotion', handleDeviceMotion);
            console.log("设备运动检测已启用");
        }
    } else {
        console.log("设备不支持运动检测");
    }
}

// 处理设备运动
function handleDeviceMotion(event) {
    if (!gameStarted) return;
    
    // 获取加速度数据
    const acceleration = event.accelerationIncludingGravity;
    
    if (!acceleration) return;
    
    // 计算加速度变化
    const deltaX = acceleration.x - gameState.lastAcceleration.x;
    const deltaY = acceleration.y - gameState.lastAcceleration.y;
    const deltaZ = acceleration.z - gameState.lastAcceleration.z;
    
    // 更新上一次加速度值
    gameState.lastAcceleration = {
        x: acceleration.x,
        y: acceleration.y,
        z: acceleration.z
    };
    
    // 计算总变化量
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);
    
    // 如果变化量超过阈值，调整游戏世界位置
    if (totalDelta > 0.5) {
        // 根据加速度变化调整游戏世界位置
        // 使用小系数来平滑移动
        const positionFactor = 0.05;
        
        // 调整游戏世界距离 - 前后移动
        const zChange = deltaZ * positionFactor;
        gameState.gameWorldDistance = THREE.MathUtils.clamp(
            gameState.gameWorldDistance + zChange,
            -5, // 最远距离
            -1  // 最近距离
        );
        
        // 应用位置变化
        updateGameWorldTransform();
    }
}

// 更新游戏世界变换（位置、旋转、缩放）
function updateGameWorldTransform() {
    const gameWorld = document.querySelector('#game-world');
    if (gameWorld) {
        // 更新位置
        gameWorld.setAttribute('position', `0 0 ${gameState.gameWorldDistance}`);
        
        // 更新旋转 - 使用欧拉角
        gameWorld.setAttribute('rotation', 
            `${gameState.gameWorldRotation.x} ${gameState.gameWorldRotation.y} ${gameState.gameWorldRotation.z}`);
        
        // 更新缩放
        gameWorld.setAttribute('scale', 
            `${gameState.gameWorldScale} ${gameState.gameWorldScale} ${gameState.gameWorldScale}`);
        
        console.log(`游戏世界更新: 位置(0,0,${gameState.gameWorldDistance}), ` +
                   `旋转(${gameState.gameWorldRotation.x},${gameState.gameWorldRotation.y},${gameState.gameWorldRotation.z}), ` +
                   `缩放(${gameState.gameWorldScale})`);
    }
}

// 调整游戏世界距离 - 修改为使用updateGameWorldTransform
function adjustGameWorldDistance(change) {
    // 限制距离范围
    gameState.gameWorldDistance = THREE.MathUtils.clamp(
        gameState.gameWorldDistance + change,
        -5, // 最远距离
        -1  // 最近距离
    );
    
    // 更新游戏世界变换
    updateGameWorldTransform();
}

// 设置设备方向检测
function setupDeviceOrientationDetection() {
    // 检查设备是否支持DeviceOrientationEvent
    if (window.DeviceOrientationEvent) {
        console.log("设备支持方向检测");
        
        // 对于iOS 13+，需要请求权限
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            // 使用与设备运动检测相同的按钮
            const orientationButton = document.getElementById('motion-permission-button') || document.createElement('button');
            orientationButton.id = 'motion-permission-button';
            orientationButton.innerText = '启用设备运动和方向检测';
            orientationButton.style.position = 'absolute';
            orientationButton.style.bottom = '10px';
            orientationButton.style.left = '10px';
            orientationButton.style.zIndex = '100';
            orientationButton.style.padding = '8px';
            orientationButton.style.backgroundColor = '#4CAF50';
            orientationButton.style.color = 'white';
            orientationButton.style.border = 'none';
            orientationButton.style.borderRadius = '4px';
            
            orientationButton.addEventListener('click', () => {
                Promise.all([
                    DeviceOrientationEvent.requestPermission(),
                    DeviceMotionEvent.requestPermission()
                ])
                .then(responses => {
                    if (responses[0] === 'granted' && responses[1] === 'granted') {
                        gameState.deviceOrientationEnabled = true;
                        gameState.deviceMotionEnabled = true;
                        window.addEventListener('deviceorientation', handleDeviceOrientationForGameWorld);
                        window.addEventListener('devicemotion', handleDeviceMotion);
                        orientationButton.style.display = 'none';
                        console.log("设备方向和运动检测权限已获取");
                    }
                })
                .catch(console.error);
            });
            
            if (!document.getElementById('motion-permission-button')) {
                document.body.appendChild(orientationButton);
            }
        } else {
            // 非iOS设备，直接添加监听器
            gameState.deviceOrientationEnabled = true;
            window.addEventListener('deviceorientation', handleDeviceOrientationForGameWorld);
            console.log("设备方向检测已启用");
        }
    } else {
        console.log("设备不支持方向检测");
    }
}

// 处理设备方向变化 - 用于游戏世界旋转
function handleDeviceOrientationForGameWorld(event) {
    if (!gameStarted) return;
    
    // 获取设备方向数据
    const alpha = event.alpha || 0; // Z轴旋转 (0-360)
    const beta = event.beta || 0;   // X轴旋转 (-180 到 180)
    const gamma = event.gamma || 0; // Y轴旋转 (-90 到 90)
    
    // 计算方向变化
    const deltaAlpha = alpha - gameState.lastDeviceOrientation.alpha;
    const deltaBeta = beta - gameState.lastDeviceOrientation.beta;
    const deltaGamma = gamma - gameState.lastDeviceOrientation.gamma;
    
    // 更新上一次方向
    gameState.lastDeviceOrientation = { alpha, beta, gamma };
    
    // 计算总变化量
    const totalDelta = Math.abs(deltaAlpha) + Math.abs(deltaBeta) + Math.abs(deltaGamma);
    
    // 如果变化量超过阈值，调整游戏世界旋转
    if (totalDelta > 1.5) {
        // 根据设备方向变化调整游戏世界旋转
        // 使用小系数来平滑旋转
        const rotationFactor = 0.05;
        
        // 更新游戏世界旋转角度
        gameState.gameWorldRotation.y += deltaAlpha * rotationFactor;
        gameState.gameWorldRotation.x += deltaBeta * rotationFactor;
        gameState.gameWorldRotation.z += deltaGamma * rotationFactor;
        
        // 应用旋转
        updateGameWorldTransform();
    }
}

// 设置手势缩放和旋转功能
function setupPinchZoom() {
    let initialDistance = 0;
    let initialScale = gameState.gameWorldScale;
    let isZooming = false;
    
    // 旋转手势变量
    let initialAngle = 0;
    let isRotating = false;
    
    // 触摸开始事件
    document.addEventListener('touchstart', (event) => {
        if (event.touches.length === 2) {
            // 计算两个触摸点之间的初始距离
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            initialDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            initialScale = gameState.gameWorldScale;
            
            // 计算初始角度
            initialAngle = Math.atan2(
                touch2.clientY - touch1.clientY,
                touch2.clientX - touch1.clientX
            ) * 180 / Math.PI;
            
            isZooming = true;
            isRotating = true;
        }
    });
    
    // 触摸移动事件
    document.addEventListener('touchmove', (event) => {
        if (isZooming && event.touches.length === 2) {
            // 计算当前两个触摸点之间的距离
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            const currentDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            
            // 计算当前角度
            const currentAngle = Math.atan2(
                touch2.clientY - touch1.clientY,
                touch2.clientX - touch1.clientX
            ) * 180 / Math.PI;
            
            // 计算缩放比例
            const scaleFactor = currentDistance / initialDistance;
            
            // 计算旋转角度变化
            const angleDelta = currentAngle - initialAngle;
            
            // 应用缩放
            gameState.gameWorldScale = THREE.MathUtils.clamp(
                initialScale * scaleFactor,
                0.2, // 最小缩放
                1.0  // 最大缩放
            );
            
            // 应用旋转 - 只旋转Y轴
            if (Math.abs(angleDelta) > 1) {
                gameState.gameWorldRotation.y += angleDelta * 0.1;
                initialAngle = currentAngle;
            }
            
            // 更新游戏世界变换
            updateGameWorldTransform();
            
            // 防止页面缩放
            event.preventDefault();
        }
    });
    
    // 触摸结束事件
    document.addEventListener('touchend', (event) => {
        if (event.touches.length < 2) {
            isZooming = false;
            isRotating = false;
        }
    });
    
    // 触摸取消事件
    document.addEventListener('touchcancel', (event) => {
        isZooming = false;
        isRotating = false;
    });
} 