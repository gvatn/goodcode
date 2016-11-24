/*
  This is an example of 3D rendering, using a
  signed distance field shader and standard derivatives
  for improved edge quality and scaling.

  We've also enabled anisotropy on the texture for
  crisp rendering at sharp angles.
 */

global.THREE = require('three')
var Detector = require('./js/Detector')
var SimplexNoise = require('./js/SimplexNoise.js')
var GeometryUtils = require('./js/utils/GeometryUtils.js')
//require('./js/libs/earcut.js')
var GPUComputationRenderer = require('./js/GPUComputationRenderer.js')
var TWEEN = require('../libs/tween.js')

var createOrbitViewer = require('three-orbit-viewer')(THREE)
var createText = require('./create-text')
var SDFShader = require('../shaders/sdf')

// load up a 'fnt' and texture
var loadFnt = require('./load');

function initPanelText() {
  loadFnt({
    font: 'fnt/DejaVu-sdf.fnt',
    image: 'fnt/DejaVu-sdf.png'
  }, panelTextFontLoaded);
}

var panelTextMaterial;

function panelTextFontLoaded(font, texture) {
  var maxAni = renderer.getMaxAnisotropy();
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearMipMapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = maxAni;

  var textContent = [
    "Welcome to goodcode!",
    "",
    "Currently investigating new technologies to form basis of",
    "further development.",
    "",
    "email: gudmund@goodcode.no"
  ].join("\n");

  var geom = createText({
    text: textContent,
    font: font,
    width: 1500,
    flipY: true,
    lineHeight: 50
  });

  var panelTextMaterial = new THREE.RawShaderMaterial(SDFShader({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    color: 'rgb(33, 0, 33)',
    opacity: 0.9
  }));

  var layout = geom.layout;
  var text = new THREE.Mesh(geom, panelTextMaterial);
  text.scale.set(0.2, 0.2, 0.2);
  // Center horizontally
  text.position.x = -205;
  text.position.y = 82;
  text.position.z = 70;
  text.rotation.x = (Math.PI / 2) + (Math.PI / 2.35);

  //new TWEEN.Tween(text.rotation).to({x: (Math.PI / 2) + (Math.PI / 2.25)}, 3000).start();
  //new TWEEN.Tween(text.position).to({y: -50}, 3000).start();

  // Scale to our units
  var textAnchor = new THREE.Object3D();
  //textAnchor.scale.multiplyScalar(-0.005);
  textAnchor.add(text);
  scene.add(textAnchor);
}

// Texture width for simulation
var WIDTH = 128;
var NUM_TEXELS = WIDTH * WIDTH;

// Water size in system units
var BOUNDS = 512;
var BOUNDS_HALF = BOUNDS * 0.5;

var container, stats;
var camera, scene, renderer, controls;
var mouseMoved = false;
var mouseCoords = new THREE.Vector2();
var raycaster = new THREE.Raycaster();

var waterMesh;
var meshRay;
var gpuCompute;
var heightmapVariable;
var waterUniforms;
var smoothShader;

var simplex = new SimplexNoise();
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

init();
animate();

function initTweens() {
    // Camera tweens

    var firstPos = { x: 130, y: 60, z: 260 };

    var camPoly = {
        x: [50, 0],
        y: [260, 100],
        z: [240, 300]
    };
    var camPolyTween = new TWEEN.Tween(camera.position).to(camPoly, 6000);
    setTimeout(function() {
      var bounceOpacity = new TWEEN.Tween({o: 0.5}).to({o: 1.0}, 1000);
      bounceOpacity.easing(TWEEN.Easing.Bounce.Out);
      bounceOpacity.onUpdate(function() {
        headingMesh.material.opacity = this.o;
      });
      bounceOpacity.start();
    }, 4500);
    camPolyTween.onUpdate(function () {
        camera.lookAt(new THREE.Vector3(0, 0, 0));
    });
    camPolyTween.interpolation(TWEEN.Interpolation.CatmullRom);
    camPolyTween.easing(function (k) {
        // Slow down towards the end
        return (k < 0.50) ? k * 1.20 : Math.sin((k - 0.50) * Math.PI) * 0.40 + 0.60;
    });


    camPolyTween.start();
    camPolyTween.onComplete(function () {
        // move text to left corner
        var textScaleCorner = new TWEEN.Tween(headingMesh.scale).to({
            x: 16,
            y: 16,
            z: 16
        }, 2000);
        textScaleCorner.easing(TWEEN.Easing.Sinusoidal.InOut)
        var textLeftCorner = new TWEEN.Tween(headingMesh.position).to({
            x: -170,
            y: 125,
            z: 30
        }, 2000);
        textLeftCorner.easing(TWEEN.Easing.Sinusoidal.InOut)

        textScaleCorner.start();
        textLeftCorner.start();

        // And move light along header
        var pointLightTween = new TWEEN.Tween(pointLight.position).to({x: -50}, 1000).start();

        // Rotate text
        var textRotateTween = new TWEEN.Tween(headingMesh.rotation).to({ x: "-" + (Math.PI / 15) }, 2500);
        textRotateTween.easing(TWEEN.Easing.Sinusoidal.Out).start();

        // Increase field of view
        var fovTween = new TWEEN.Tween({
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z,
          w: camera.fov,
          u: 0
        }).to({
          x: camera.position.x - 10,
          y: camera.position.y + 50,
          z: camera.position.z + 40,
          w: 50,
          u: 30
        }, 2000);
        fovTween.onUpdate(function () {
          camera.position.set(this.x, this.y, this.z);
          camera.fov = this.w;
          camera.lookAt(new THREE.Vector3(0, this.u, 0));
          camera.updateProjectionMatrix();
        });
        fovTween.start();

        // Bring textPanel up from water
        var textPanelUpTween = new TWEEN.Tween(textPanelMesh.position).to({ y: 0 }, 2000);
        textPanelUpTween.start();
        textPanelUpTween.onComplete(function () {
          // rotate panel into view and bring it a little forward
          var textPanelRotateTween = new TWEEN.Tween(textPanelMesh.rotation).to({ x: Math.PI / 2.35 }, 1500);
          textPanelRotateTween.easing(TWEEN.Easing.Bounce.Out);
          //var textForwardTween = new TWEEN.Tween(textPanelMesh.position).to({ z: 55 }, 1500);
          textPanelRotateTween.start();
          textPanelRotateTween.onComplete(function() {
              initPanelText();
          });
          //textForwardTween.start();

          // "Move water down" by moving rest up
          var camFromWater = new TWEEN.Tween(camera.position).to({ y: "+30" }, 1000);
          var headingFromWater = new TWEEN.Tween(headingMesh.position).to({ y: "+30" }, 1000);
          var panelFromWater = new TWEEN.Tween(textPanelMesh.position).to({ y: "+30", z: 50 }, 1500);
          camFromWater.easing(TWEEN.Easing.Sinusoidal.Out);
          headingFromWater.easing(TWEEN.Easing.Sinusoidal.Out);
          panelFromWater.easing(TWEEN.Easing.Sinusoidal.Out);
          camFromWater.start();
          headingFromWater.start();
          camFromWater.start();
          panelFromWater.start();

        });
        });


}


var textPanelMesh;
function initTextPanel() {
    var geometry = new THREE.PlaneGeometry(500, 255, 32);
    geometry.rotateX(Math.PI / 2);
    var material = new THREE.MeshBasicMaterial({
        color: 0xcfcfff,
        side: THREE.DoubleSide
    });
    textPanelMesh = new THREE.Mesh(geometry, material);
    textPanelMesh.position.y = -15;
    scene.add(textPanelMesh);
}

var headingMesh;
function initHeadingMesh() {
  var loader = new THREE.JSONLoader();
  loader.load('./meshes/goodcode.json', function(geometry) {
    //debugger;
    var material = new THREE.MeshBasicMaterial({
        color: 0xcfcfff,
        side: THREE.DoubleSide
    });
    var material2 = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      shading: THREE.FlatShading,
      transparent: true,
      opacity: 0.5
    });
    geometry.computeBoundingBox();
    geometry.computeVertexNormals();
    textGeo = geometry;
    var triangleAreaHeuristics = 0.1 * (height * size);
        for (var i = 0; i < textGeo.faces.length; i++) {
            var face = textGeo.faces[i];
            if (face.materialIndex == 1) {
                for (var j = 0; j < face.vertexNormals.length; j++) {
                    face.vertexNormals[j].z = 0;
                    face.vertexNormals[j].normalize();
                }
                var va = textGeo.vertices[face.a];
                var vb = textGeo.vertices[face.b];
                var vc = textGeo.vertices[face.c];

                var s = THREE.GeometryUtils.triangleArea(va, vb, vc);
                if (s > triangleAreaHeuristics) {
                    for (var j = 0; j < face.vertexNormals.length; j++) {
                        face.vertexNormals[j].copy(face.normal);
                    }
                }
            }
        }
    headingMesh = new THREE.Mesh(geometry, material2);
    headingMesh.position.y = 20;
    headingMesh.position.x = 35;
    headingMesh.scale.set(48, 48, 48);
    scene.add(headingMesh);
  });
}

function init() {

    container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.set(130, 80, 280);

    scene = new THREE.Scene();

    var sun = new THREE.DirectionalLight(0xFFFFFF, 1.0);
    sun.position.set(300, 400, 175);
    scene.add(sun);

    // Sun 2
    var sun2 = new THREE.DirectionalLight(0x40A040, 0.6);
    sun2.position.set(-100, 350, -200);
    scene.add(sun2);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    //controls = new THREE.OrbitControls(camera, renderer.domElement);
    //stats = new Stats();
    //container.appendChild(stats.dom);

    document.addEventListener('mousemove', onDocumentMouseMove, false);
    document.addEventListener('touchstart', onDocumentTouchStart, false);
    document.addEventListener('touchmove', onDocumentTouchMove, false);
    document.addEventListener('keydown', function (event) {
        // Toggle wireframe on 'W'
        if (event.keyCode === 87) {
            waterMesh.material.wireframe = !waterMesh.material.wireframe;
            waterMesh.material.needsUpdate = true;
        }
    }, false);

    window.addEventListener('resize', onWindowResize, false);



    initText();
    //initHeading();

    initWater();

    initTextPanel();

    initHeadingMesh();

    initTweens();


    heightmapVariable.material.uniforms.mouseSize.value = 20.0;
    heightmapVariable.material.uniforms.viscosityConstant.value = 0.03;

    smoothWater();

}

// todo: refactor from bottom into this
var pointLight;
function initText() {
    pointLight = new THREE.PointLight(0xcc66cc, 1.5);
    pointLight.position.set(0, 100, 90);
    scene.add(pointLight);
}

function initWater() {
    var materialColor = 0x0040C0;

    var geometry = new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, WIDTH - 1, WIDTH - 1);

    // Make a clone of MeshPhongMaterial, with own vertex shader
    var material = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([
            THREE.ShaderLib['phong'].uniforms,
            {
                heightmap: { value: null }
            }
        ]),
        vertexShader: document.getElementById('waterVertexShader').textContent,
        fragmentShader: THREE.ShaderChunk['meshphong_frag']
    });

    material.lights = true;
    // Attributes from MeshPhongMaterial
    material.color = new THREE.Color(materialColor);
    material.specular = new THREE.Color(0x111111);
    material.shininess = 50;

    // Set the uniforms with the material values
    material.uniforms.diffuse.value = material.color;
    material.uniforms.specular.value = material.specular;
    material.uniforms.shininess.value = Math.max(material.shininess, 1e-4);
    material.uniforms.opacity.value = material.opacity;

    // Defines
    material.defines.WIDTH = WIDTH.toFixed(1);
    material.defines.BOUNDS = BOUNDS.toFixed(1);

    waterUniforms = material.uniforms;

    // Water mesh
    waterMesh = new THREE.Mesh(geometry, material);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.matrixAutoUpdate = false;
    waterMesh.updateMatrix();

    scene.add(waterMesh);

    // Mesh for mouse raycasting
    var geometryRay = new THREE.PlaneBufferGeometry(BOUNDS, BOUNDS, 1, 1);
    meshRay = new THREE.Mesh(geometryRay, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, visible: false }));
    meshRay.rotation.x = -Math.PI / 2;
    meshRay.matrixAutoUpdate = false;
    meshRay.updateMatrix();
    scene.add(meshRay);

    // Create the gpu computation object
    gpuCompute = new GPUComputationRenderer(WIDTH, WIDTH, renderer);
    var heightmap0 = gpuCompute.createTexture();

    fillTexture(heightmap0);

    heightmapVariable = gpuCompute.addVariable("heightmap", document.getElementById('heightmapFragmentShader').textContent, heightmap0);

    gpuCompute.setVariableDependencies(heightmapVariable, [heightmapVariable]);

    heightmapVariable.material.uniforms.mousePos = { value: new THREE.Vector2(10000, 10000) };
    heightmapVariable.material.uniforms.mouseSize = { value: 20.0 };
    heightmapVariable.material.uniforms.viscosityConstant = { value: 0.03 };
    heightmapVariable.material.defines.BOUNDS = BOUNDS.toFixed(1);

    var error = gpuCompute.init();
    if (error !== null) {
        console.log(error);
    }

    // Create compute shader to smooth the water surface and velocity
    smoothShader = gpuCompute.createShaderMaterial(document.getElementById('smoothFragmentShader').textContent, {
        texture: { value: null }
    });

}

function fillTexture(texture) {
    var waterMaxHeight = 10;

    function noise(x, y, z) {
        var multR = waterMaxHeight;
        var mult = 0.025;
        var r = 0;
        for (var i = 0; i < 15; i++) {
            r += multR * simplex.noise3d(x * mult, y * mult, z * mult);
            multR *= 0.53 + 0.025 * i;
            mult *= 1.25;
        }
        return r;
    }

    var pixels = texture.image.data;

    var p = 0;
    for (var j = 0; j < WIDTH; j++) {
        for (var i = 0; i < WIDTH; i++) {
            var x = i * 128 / WIDTH;
            var y = j * 128 / WIDTH;
            pixels[p + 0] = noise(x, y, 123.4);
            pixels[p + 1] = 0;
            pixels[p + 2] = 0;
            pixels[p + 3] = 1;

            p += 4;
        }
    }
}

function smoothWater() {
    var currentRenderTarget = gpuCompute.getCurrentRenderTarget(heightmapVariable);
    var alternateRenderTarget = gpuCompute.getAlternateRenderTarget(heightmapVariable);
    for (var i = 0; i < 10; i++) {
        smoothShader.uniforms.texture.value = currentRenderTarget.texture;
        gpuCompute.doRenderTarget(smoothShader, alternateRenderTarget);

        smoothShader.uniforms.texture.value = alternateRenderTarget.texture;
        gpuCompute.doRenderTarget(smoothShader, currentRenderTarget);
    }
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setMouseCoords(x, y) {
    mouseCoords.set((x / renderer.domElement.clientWidth) * 2 - 1, -(y / renderer.domElement.clientHeight) * 2 + 1);
    mouseMoved = true;
}

function onDocumentMouseMove(event) {
    setMouseCoords(event.clientX, event.clientY);
}

function onDocumentTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
    }
}

function onDocumentTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        setMouseCoords(event.touches[0].pageX, event.touches[0].pageY);
    }
}

function animate() {
    requestAnimationFrame(animate);
    render();

    TWEEN.update();

    //stats.update();
}

function render() {
    // Set uniforms from mouse interaction

    var uniforms = heightmapVariable.material.uniforms;
    if (mouseMoved) {
        raycaster.setFromCamera(mouseCoords, camera);
        var intersects = raycaster.intersectObject(meshRay);

        if (intersects.length > 0) {
            var point = intersects[0].point;
            uniforms.mousePos.value.set(point.x, point.z);
        }
        else {
            uniforms.mousePos.value.set(10000, 10000);
        }
        mouseMoved = false;
    }
    else {
        uniforms.mousePos.value.set(10000, 10000);
    }

    // Do gpu computation
    gpuCompute.compute();

    // Get compute output in custom uniform
    waterUniforms.heightmap.value = gpuCompute.getCurrentRenderTarget(heightmapVariable).texture;

    // Render
    renderer.render(scene, camera);

}


// Text rendering

var hex, color;
var cameraTarget;
var group, textMesh1, textMesh2, textGeo, textMaterial;
var firstLetter = true;

var text = "goodcode",
    height = 20,
    size = 65,
    hover = -22,
    curveSegments = 4,
    bevelThickness = 2,
    bevelSize = 1.5,
    bevelSegments = 3,
    bevelEnabled = false,
    font = undefined;


function initHeading() {
  textMaterial = new THREE.MultiMaterial([
      new THREE.MeshPhongMaterial({ color: 0xffffff, shading: THREE.FlatShading }), // front
      new THREE.MeshPhongMaterial({ color: 0xffffff, shading: THREE.SmoothShading }) // side
  ]);

  group = new THREE.Group();
  group.position.y = 100;

  scene.add(group);

  loadFont();
}


function loadFont() {
    var loader = new THREE.FontLoader();
    var fontName = "droid/droid_sans";
    var fontWeight = "bold";
    loader.load('fonts/' + fontName + '_' + fontWeight + '.typeface.json', function (response) {
        font = response;
        refreshText();
    });
}

function createHeadingText() {

    textGeo = new THREE.TextGeometry(text, {
        font: font,
        size: size,
        height: height,
        curveSegments: curveSegments,
        bevelThickness: bevelThickness,
        bevelSize: bevelSize,
        bevelEnabled: bevelEnabled,
        material: 0,
        extrudeMaterial: 1
    });

    textGeo.computeBoundingBox();
    textGeo.computeVertexNormals();

    if (!bevelEnabled) {

        var triangleAreaHeuristics = 0.1 * (height * size);
        for (var i = 0; i < textGeo.faces.length; i++) {
            var face = textGeo.faces[i];
            if (face.materialIndex == 1) {
                for (var j = 0; j < face.vertexNormals.length; j++) {
                    face.vertexNormals[j].z = 0;
                    face.vertexNormals[j].normalize();
                }
                var va = textGeo.vertices[face.a];
                var vb = textGeo.vertices[face.b];
                var vc = textGeo.vertices[face.c];

                var s = THREE.GeometryUtils.triangleArea(va, vb, vc);
                if (s > triangleAreaHeuristics) {
                    for (var j = 0; j < face.vertexNormals.length; j++) {
                        face.vertexNormals[j].copy(face.normal);
                    }
                }
            }
        }

    }

    var centerOffset = -0.5 * (textGeo.boundingBox.max.x - textGeo.boundingBox.min.x);
    textMesh1 = new THREE.Mesh(textGeo, textMaterial);

    textMesh1.position.x = centerOffset;
    textMesh1.position.y = hover;
    textMesh1.position.z = 0;

    textMesh1.rotation.x = -0.1;
    textMesh1.rotation.y = Math.PI * 2;

    group.add(textMesh1);

}

function refreshText() {

    group.remove(textMesh1);
    if (!text) return;
    createHeadingText();

}
