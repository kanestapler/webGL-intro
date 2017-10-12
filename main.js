var gl;
var shaderProgram;
var mudTexture;
var mvMatrix = mat4.create();
var mvMatrixStack = [];
var pMatrix = mat4.create();
var starVertexPositionBuffer;
var starVertexTextureCoordBuffer;
var worldVertexPositionBuffer = null;
var worldVertexTextureCoordBuffer = null;
var effectiveFPMS = 60 / 1000;
var keyStates = {};
var zoom = -15;
var tilt = 90;
var spin = 0;
var lastTime = 0;
var stars = [];
var pitch = 0;
var pitchRate = 0;
var yaw = 0;
var yawRate = 0;
var xPos = 0;
var yPos = 0.4;
var zPos = 0;
var speed = 0;
var joggingAngle = 0;

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = canvas.width;
        gl.viewportHeight = canvas.height;
    } catch (e) {
    }
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}


function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }

    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }

    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }

    gl.shaderSource(shader, str);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }

    return shader;
}

function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");

    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }

    gl.useProgram(shaderProgram);

    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

    shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
    gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);

    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
}


function handleLoadedTexture(texture) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.bindTexture(gl.TEXTURE_2D, null);
}

function initTexture() {
    mudTexture = gl.createTexture();
    mudTexture.image = new Image();
    mudTexture.image.onload = function () {
        handleLoadedTexture(mudTexture)
    }

    mudTexture.image.src = "glass.gif";
}

function mvPushMatrix() {
    var copy = mat4.create();
    mat4.set(mvMatrix, copy);
    mvMatrixStack.push(copy);
}

function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
        throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}


function setMatrixUniforms() {
    gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
    gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

function drawScene() {
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (worldVertexTextureCoordBuffer == null || worldVertexPositionBuffer == null) {
        return;
    }

    mat4.perspective(45, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0, pMatrix);
    mat4.identity(mvMatrix);
    mat4.rotate(mvMatrix, degToRad(-pitch), [1, 0, 0]);
    mat4.rotate(mvMatrix, degToRad(-yaw), [0, 1, 0]);
    mat4.translate(mvMatrix, [-xPos, -yPos, -zPos]);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, mudTexture);
    gl.uniform1i(shaderProgram.samplerUniform, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
    gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, worldVertexTextureCoordBuffer.itemSize, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
    gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, worldVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
    setMatrixUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, worldVertexPositionBuffer.numItems);

}

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var elapsed = timeNow - lastTime;
        if (speed != 0) {
            xPos -= Math.sin(degToRad(yaw)) * speed * elapsed;
            zPos -= Math.cos(degToRad(yaw)) * speed * elapsed;
            joggingAngle += elapsed * 0.6;
            yPos = Math.sin(degToRad(joggingAngle)) / 20 + 0.4
        }

        yaw += yawRate * elapsed;
        pitch += pitchRate * elapsed;
    }
    lastTime = timeNow;
    // console.log('Speed: ', speed);
    // console.log('xPos: ', xPos);
    // console.log('yPos: ', yPos);
    // console.log('zPos: ', zPos);
    // console.log('yawRate: ', yawRate);
    // console.log('pitchRate: ', pitchRate);
}


function tick() {
    requestAnimFrame(tick);
    handleKeys();
    drawScene();
    animate();
}

function loadWorld() {
    var request = new XMLHttpRequest();
    request.open("GET", "world.txt");
    request.onreadystatechange = function () {
        if (request.readyState == 4) {
            handleLoadedWorld(request.responseText);
        }
    }
    request.send();
    //handleLoadedWorld("\nNUMPOLLIES 36\n\n// Floor 1\n-3.0 0.0 -3.0 0.0 6.0\n-3.0 0.0 3.0 0.0 0.0\n 3.0 0.0 3.0 6.0 0.0\n\n-3.0 0.0 -3.0 0.0 6.0\n 3.0 0.0 -3.0 6.0 6.0\n 3.0 0.0 3.0 6.0 0.0\n\n// Ceiling 1\n-3.0 1.0 -3.0 0.0 6.0\n-3.0 1.0 3.0 0.0 0.0\n 3.0 1.0 3.0 6.0 0.0\n-3.0 1.0 -3.0 0.0 6.0\n 3.0 1.0 -3.0 6.0 6.0\n 3.0 1.0 3.0 6.0 0.0\n\n// A1\n\n-2.0 1.0 -2.0 0.0 1.0\n-2.0 0.0 -2.0 0.0 0.0\n-0.5 0.0 -2.0 1.5 0.0\n-2.0 1.0 -2.0 0.0 1.0\n-0.5 1.0 -2.0 1.5 1.0\n-0.5 0.0 -2.0 1.5 0.0\n\n// A2\n\n 2.0 1.0 -2.0 2.0 1.0\n 2.0 0.0 -2.0 2.0 0.0\n 0.5 0.0 -2.0 0.5 0.0\n 2.0 1.0 -2.0 2.0 1.0\n 0.5 1.0 -2.0 0.5 1.0\n 0.5 0.0 -2.0 0.5 0.0\n\n// B1\n\n-2.0 1.0 2.0 2.0 1.0\n-2.0 0.0 2.0 2.0 0.0\n-0.5 0.0 2.0 0.5 0.0\n-2.0 1.0 2.0 2.0 1.0\n-0.5 1.0 2.0 0.5 1.0\n-0.5 0.0 2.0 0.5 0.0\n\n// B2\n\n 2.0 1.0 2.0 2.0 1.0\n 2.0 0.0 2.0 2.0 0.0\n 0.5 0.0 2.0 0.5 0.0\n 2.0 1.0 2.0 2.0 1.0\n 0.5 1.0 2.0 0.5 1.0\n 0.5 0.0 2.0 0.5 0.0\n\n// C1\n\n-2.0 1.0 -2.0 0.0 1.0\n-2.0 0.0 -2.0 0.0 0.0\n-2.0 0.0 -0.5 1.5 0.0\n-2.0 1.0 -2.0 0.0 1.0\n-2.0 1.0 -0.5 1.5 1.0\n-2.0 0.0 -0.5 1.5 0.0\n\n// C2\n\n-2.0 1.0 2.0 2.0 1.0\n-2.0 0.0 2.0 2.0 0.0\n-2.0 0.0 0.5 0.5 0.0\n-2.0 1.0 2.0 2.0 1.0\n-2.0 1.0 0.5 0.5 1.0\n-2.0 0.0 0.5 0.5 0.0\n\n// D1\n\n2.0 1.0 -2.0 0.0 1.0\n2.0 0.0 -2.0 0.0 0.0\n2.0 0.0 -0.5 1.5 0.0\n2.0 1.0 -2.0 0.0 1.0\n2.0 1.0 -0.5 1.5 1.0\n2.0 0.0 -0.5 1.5 0.0\n\n// D2\n\n2.0 1.0 2.0 2.0 1.0\n2.0 0.0 2.0 2.0 0.0\n2.0 0.0 0.5 0.5 0.0\n2.0 1.0 2.0 2.0 1.0\n2.0 1.0 0.5 0.5 1.0\n2.0 0.0 0.5 0.5 0.0\n\n// Upper hallway – L\n-0.5 1.0 -3.0 0.0 1.0\n-0.5 0.0 -3.0 0.0 0.0\n-0.5 0.0 -2.0 1.0 0.0\n-0.5 1.0 -3.0 0.0 1.0\n-0.5 1.0 -2.0 1.0 1.0\n-0.5 0.0 -2.0 1.0 0.0\n\n// Upper hallway – R\n0.5 1.0 -3.0 0.0 1.0\n0.5 0.0 -3.0 0.0 0.0\n0.5 0.0 -2.0 1.0 0.0\n0.5 1.0 -3.0 0.0 1.0\n0.5 1.0 -2.0 1.0 1.0\n0.5 0.0 -2.0 1.0 0.0\n\n// Lower hallway – L\n-0.5 1.0 3.0 0.0 1.0\n-0.5 0.0 3.0 0.0 0.0\n-0.5 0.0 2.0 1.0 0.0\n-0.5 1.0 3.0 0.0 1.0\n-0.5 1.0 2.0 1.0 1.0\n-0.5 0.0 2.0 1.0 0.0\n\n// Lower hallway – R\n0.5 1.0 3.0 0.0 1.0\n0.5 0.0 3.0 0.0 0.0\n0.5 0.0 2.0 1.0 0.0\n0.5 1.0 3.0 0.0 1.0\n0.5 1.0 2.0 1.0 1.0\n0.5 0.0 2.0 1.0 0.0\n\n\n// Left hallway – Lw\n\n-3.0 1.0 0.5 1.0 1.0\n-3.0 0.0 0.5 1.0 0.0\n-2.0 0.0 0.5 0.0 0.0\n-3.0 1.0 0.5 1.0 1.0\n-2.0 1.0 0.5 0.0 1.0\n-2.0 0.0 0.5 0.0 0.0\n\n// Left hallway – Hi\n\n-3.0 1.0 -0.5 1.0 1.0\n-3.0 0.0 -0.5 1.0 0.0\n-2.0 0.0 -0.5 0.0 0.0\n-3.0 1.0 -0.5 1.0 1.0\n-2.0 1.0 -0.5 0.0 1.0\n-2.0 0.0 -0.5 0.0 0.0\n\n// Right hallway – Lw\n\n3.0 1.0 0.5 1.0 1.0\n3.0 0.0 0.5 1.0 0.0\n2.0 0.0 0.5 0.0 0.0\n3.0 1.0 0.5 1.0 1.0\n2.0 1.0 0.5 0.0 1.0\n2.0 0.0 0.5 0.0 0.0\n\n// Right hallway – Hi\n\n3.0 1.0 -0.5 1.0 1.0\n3.0 0.0 -0.5 1.0 0.0\n2.0 0.0 -0.5 0.0 0.0\n3.0 1.0 -0.5 1.0 1.0\n2.0 1.0 -0.5 0.0 1.0\n2.0 0.0 -0.5 0.0 0.0\n");
}

function handleLoadedWorld(data) {
    var lines = data.split("\n");
    var vertexCount = 0;
    var vertexPositions = [];
    var vertexTextureCoords = [];
    for (var i in lines) {
        var vals = lines[i].replace(/^\s+/, "").split(/\s+/);
        if (vals.length == 5 && vals[0] != "//") {
            // It is a line describing a vertex; get X, Y and Z first
            vertexPositions.push(parseFloat(vals[0]));
            vertexPositions.push(parseFloat(vals[1]));
            vertexPositions.push(parseFloat(vals[2]));

            // And then the texture coords
            vertexTextureCoords.push(parseFloat(vals[3]));
            vertexTextureCoords.push(parseFloat(vals[4]));

            vertexCount += 1;
        }
    }
    worldVertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexPositions), gl.STATIC_DRAW);
    worldVertexPositionBuffer.itemSize = 3;
    worldVertexPositionBuffer.numItems = vertexCount;

    worldVertexTextureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, worldVertexTextureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexTextureCoords), gl.STATIC_DRAW);
    worldVertexTextureCoordBuffer.itemSize = 2;
    worldVertexTextureCoordBuffer.numItems = vertexCount;
    document.getElementById("loadingtext").style.display = "none";
}



function webGLStart() {
    var canvas = document.getElementById("lesson01-canvas");
    initGL(canvas);
    initShaders();
    initTexture();
    loadWorld();

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);

    document.onkeydown = keyDown;
    document.onkeyup = keyUp;

    tick();
}

function keyDown(keyEvent) {
    keyStates[keyEvent.keyCode] = true;
}

function keyUp(keyEvent) {
    keyStates[keyEvent.keyCode] = false;
}

function handleKeys() {
    if (keyStates[33] || keyStates[219]) { // Page up or [
        pitchRate = 0.1;
    } else if (keyStates[34] || keyStates[221]) { // Page down or ]
        pitchRate = -0.1;
    } else {
        pitchRate = 0;
    }

    if (keyStates[38] || keyStates[87]) { // Up or w
        speed = 0.005;
    } else if (keyStates[40] || keyStates[83]) { // Down or s
        speed = -0.005;
    } else {
        speed = 0;
    }

    //console.log(keyStates);
    if (keyStates[37] || keyStates[65]) { // left or a
        yawRate = 0.1;
    } else if (keyStates[39] || keyStates[68]) { // right or d
        yawRate = -0.1;
    } else {
        yawRate = 0;
    }
}

function degToRad(degrees) {
    return degrees * Math.PI / 180;
}