  // Set up the sketchpad.  This uses paper.js to render the pencil markings.
  // The pencil itself is rendered as a 3D object using THREE.js, but we'll get to that later.
  // There are 2 canvases in use, one for the pencil and one for the actual sketch.

  (function(window){
	
	function Sketch() {
		this.group = new paper.Group();
		this.isDrawing = false;
		
    // paper.js allows us to use the mouse easily to create vector lines.
    // more here http://paperjs.org/tutorials/interaction/creating-mouse-tools/
		this.mouseTool = new paper.Tool();
		this.mouseTool.minDistance = 5;
		this.mouseTool.maxDistance = 30;
		this.mouseTool.on('mousedown', this.onMouseDown.bind(this));
		this.mouseTool.on('mousedrag', this.onMouseDrag.bind(this));
		this.mouseTool.on('mouseup', this.onMouseUp.bind(this));
	}
	
	Sketch.prototype.onMouseDown = function(e) {
		this.isDrawing = true;
		this.currPath = new paper.Path();
		
		this.currPath.fillColor = '#424242';
		
		this.currPath.add(e.point);
	}
	
	Sketch.prototype.onMouseDrag = function(e) {
		if (!this.isDrawing) return;
		
		if (!e.point.isInside(this.sketchingBounds)){
			this.onMouseUp(e);
			return;
		}
		
		var step = e.delta.divide(2);
		step.angle += 10;
		
		var top = e.middlePoint.add(step);
		var bottom = e.middlePoint.subtract(step);
		
		this.currPath.add(top);
		this.currPath.insert(0, bottom);
		this.currPath.smooth(10);
	}
	
	Sketch.prototype.onMouseUp = function(e) {
		if (!this.isDrawing) return;
		
		this.isDrawing = false;
		
		if (e.point.isInside(this.sketchingBounds)) {
			this.currPath.add(e.point);
			this.currPath.closed = true;
		}
		
		this.group.addChild(this.currPath);
	}

	Sketch.prototype.setSketchingBounds = function(x, y, width, height) {
		this.sketchingBounds = new paper.Rectangle(x, y, width, height);
	}
	
	window.Sketch = Sketch;
	
})(window);



/* Set up the Pencil */

var pencil = (function() {
	var pencil,
			isDrawing,
			rangeX = 0,
			rangeY = 0,
			scale = 1.5,
			canvasW,
			canvasH,
			moveRotationRange = {x: 100, y: 30};
	
	function init(_canvasW, _canvasH, onReady) {
		canvasW = _canvasW;
		canvasH = _canvasH;
		isDrawing = false;
    pencil = new THREE.Object3D();
    
    // Load the 3D model and its materials
    var mtlLoader = new THREE.MTLLoader();
		mtlLoader.load( 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/356608/PENCIL.mtl', function( materials ) {
			materials.preload();
			
			var objLoader = new THREE.OBJLoader();
			objLoader.setMaterials( materials );
			objLoader.load( 'https://s3-us-west-2.amazonaws.com/s.cdpn.io/356608/PENCIL.obj', function ( object ) {
				var scale = 1.5;
				object.rotation.x = toRad(90);
				object.scale.set(scale, scale, scale);
				pencil.add(object);
				scene.add( pencil );
			});
			
			stopDrawing();
			onReady();
		});
	}
	
	function startDrawing() {
		isDrawing = true;
		TweenLite.to(pencil.position, 0.2, {z: 0, ease: Expo.easeOut});
	}
	
	function stopDrawing() {
		isDrawing = false;
		TweenLite.to(pencil.position, 0.2, {z: 2, ease: Quad.easeInOut});
	}
	
	function move(x, y) {
		rangeX = (x / wW) - 0.5;
		rangeY = (y / wH) - 0.5;
		
    // Convert the current mouse position to a point in 3D space.  This involves 'unprojecting' the
    // 2D values into 3D space.  More info here: 
    // https://barkofthebyte.azurewebsites.net/post/2014/05/05/three-js-projecting-mouse-clicks-to-a-3d-scene-how-to-do-it-and-how-it-works
		var mouse3D = new THREE.Vector3( (x / wW) * 2 - 1, -(y / wH) * 2 + 1, 0.5 );
		mouse3D.unproject(camera);
		var dir = mouse3D.sub(camera.position).normalize();
		dir.x *= wW / canvasW;
		dir.y *= wH / canvasH;
		var distance = - camera.position.z / dir.z;
		var pos = camera.position.clone().add( dir.multiplyScalar( distance ) );
		
    pencil.position.x = pos.x;
    pencil.position.y = pos.y;
    TweenLite.to(pencil.rotation, 0.2, {y: rangeX * toRad(moveRotationRange.x), x: rangeY * toRad(moveRotationRange.y), z: toRad(rangeY * 200)});
	}
	
  // Utility function for converting degrees to radians
	function toRad(deg) {
		return (Math.PI / 180) * deg;
	}
	
	return {
		init: init,
		startDrawing: startDrawing,
		stopDrawing: stopDrawing,
		move: move,
		isDrawing: function() {
			return isDrawing;
		}
	}
	
})();


// Set up the pencil's shadow.  This gives the illusion that the pencil is floating above the pad.
// The shadow is actually a 2D vector graphic rendered in the same canvas as the sketch (also using paper.js).
// I'm not sure how to get a crisp shadow in THREE.js, which is why I used the 2D canvas to render it.
// The shadow rotates when the pencil is moved across the sketchpad to give the illusion that the 
// light source is at a consistent position (to the top right).
// It also gets darker as the pencil is moved closer to the paper.

(function(window) {
	
	function Shadow() {
		this.rotationRange = 90;
		this.startAngle = -25;
		this.grp = new paper.Group();
		this.grp.applyMatrix = false;
		this.grp.rotation = this.startAngle;
		this.grp.pivot = new paper.Point(0, 0);
		
    // Load the shadow graphic
		paper.project.importSVG('https://s3-us-west-2.amazonaws.com/s.cdpn.io/356608/shadow.svg', function(el) {
			el.position = new paper.Point(0, 85);
			el.opacity = 0.5;
			el.scale(0.6);
			el.applyMatrix = false;
			this.el = el;
			this.grp.addChild(this.el);
			this.goFar();
		}.bind(this));
		
		this.isDragging = false;
	}
	
	Shadow.prototype.move = function(x, y) {
		if (!this.el) return;
		
	  rangeX = (x / wW) - 0.5;
		this.grp.rotation = this.startAngle - (this.rotationRange * rangeX);
		this.grp.position = new paper.Point(x, y);
	}
	
	Shadow.prototype.goNear = function() {
		if (!this.el) return;
		
		this.isDragging = true;
		TweenLite.to(this.el, 0.2, {opacity: 0.4});
		TweenLite.to(this.el.position, 0.2, {y: 105, ease: Expo.easeOut});
		TweenLite.to(this.el.scaling, 0.2, {y: 1, ease: Expo.easeOut});
	}
	
	Shadow.prototype.goFar = function() {
		if (!this.el) return;
		
		this.isDragging = false;
		TweenLite.to(this.el, 0.2, {opacity: 0.1});
		TweenLite.to(this.el.position, 0.2, {y: 205, ease: Quad.easeInOut});
		TweenLite.to(this.el.scaling, 0.2, {y: 1.2, ease: Quad.easeInOut});
	}
	
	window.Shadow = Shadow;
	
})(window)


// The main program.
// This bit brings all our parts together, the shadow, pencil and drawing mechanic
var wW,
		wH,
		pencilCanvas,
		pencilCanvasW = 1920,
		pencilCanvasH = 1080,
		sketchCanvas,
		scene,
		camera,
		renderer,
		sketch,
		sketchpad,
		shadow,
		introTl, 
		pencilPos = {x: 0, y: 0};

function init() {
	sketchpad = document.getElementById('sketchpad');
	
	// Pencil Renderer
	pencilCanvas = document.getElementById('pencil3D');
	pencilCanvas.setAttribute('width', pencilCanvasW + 'px');
  pencilCanvas.setAttribute('height', pencilCanvasH + 'px');
	
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(45, pencilCanvasW / pencilCanvasH, 0.1, 1000);
	camera.position.z = 25;
	camera.lookAt(scene.position);
	renderer = new THREE.WebGLRenderer({
    canvas: pencilCanvas,
    antialias: true,
    alpha: true
  });
	renderer.setSize(pencilCanvasW, pencilCanvasH);
  
  // Light up the pencil, otherwise it would appear boring and flat
  var light1 = new THREE.AmbientLight( 0x404040 );
  light1.intensity = 6;
  scene.add(light1);
  
  var light2 = new THREE.SpotLight( 0x404040 );
  light2.intensity = 3;
  light2.position.set(-5, 15, 10);
  light2.target.position = new THREE.Vector3(0, 0, 5);
  scene.add(light2);
  
  var light3 = new THREE.SpotLight( 0x404040 );
  light3.intensity = 0.5;
  light3.position.set(5, -15, 10);
  light3.target.position = new THREE.Vector3(0, 0, 5);
  scene.add(light3);
	
  // Instantiate the sketchpad
	sketchCanvas = document.getElementById('sketch');
	paper.setup(sketchCanvas);
	sketch = new Sketch();
	shadow = new Shadow();
	pencil.init(pencilCanvasW, pencilCanvasH, onReady);
	
	onResize();
	
  // Some intro animation (the sketchpad expands once everything is loaded)
	introTl = new TimelineLite({paused: true, delay: 2, onComplete: function() {
    // Allow the user to interact with the mouse only after the intro animation has finished
		window.addEventListener('mousedown', onMouseDown);
		window.addEventListener('mouseup', onMouseUp);
		window.addEventListener('mousemove', onMove);
		window.addEventListener('resize', onResize);
	}});
  introTl.to('#intro', 0.3, {opacity: 0});
	introTl.from('#sketchpad', 0.5, {scaleY: 0, ease: Expo.easeInOut});
	introTl.append(TweenMax.fromTo(pencilPos, 0.7, {x: wW / 2, y: wH + 300}, {x: wW * 0.7, y: wH * 0.5, roundProps: 'x,y', ease: Expo.easeOut}));
	
	render();
}

function onReady() {
	introTl.play();
}

function onResize() {
  // Make the sketchpad responsive
	wW = window.innerWidth;
	wH = window.innerHeight;
	
	var sketchpadW = (wW - 100);
	var sketchpadH = (wH - 100);
	
	sketchpad.style.width = sketchpadW + 'px';
  sketchpad.style.height = sketchpadH + 'px';
	
  // Make sure the user can't draw outside of the sketchpad bounds
	sketch.setSketchingBounds(50, 50, sketchpadW, sketchpadH);
	sketchCanvas.setAttribute('width', wW);
  sketchCanvas.setAttribute('height', wH);
  paper.view.viewSize = new paper.Size(wW, wH);
  paper.view.draw();
  
 	pencilCanvas.style.left = ((wW / 2) - (pencilCanvasW / 2)) + 'px';
  pencilCanvas.style.top = ((wH / 2) - (pencilCanvasH / 2)) + 'px';
}

function onMove(e) {
  // When the pencil is moved but NOT drawing, make the movement animate at a slightly smoother rate
	var duration = pencil.isDrawing() ? 0.05 : 0.25;
	TweenLite.to(pencilPos, duration, {x: e.clientX, y: e.clientY});
}

function onMouseDown(e) {
	pencil.startDrawing();
	shadow.goNear();
}

function onMouseUp(e) {
	pencil.stopDrawing();
	shadow.goFar();
}

function render() {
	requestAnimationFrame(render);
	renderer.render(scene, camera);
	pencil.move(pencilPos.x, pencilPos.y);
	shadow.move(pencilPos.x, pencilPos.y);
	paper.view.draw();
}

init();
