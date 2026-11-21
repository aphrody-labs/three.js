import { ArrayCamera } from '../../cameras/ArrayCamera.js';
import { EventDispatcher } from '../../core/EventDispatcher.js';
import { PerspectiveCamera } from '../../cameras/PerspectiveCamera.js';
import { RAD2DEG } from '../../math/MathUtils.js';
import { Vector2 } from '../../math/Vector2.js';
import { Vector4 } from '../../math/Vector4.js';
import { WebXRController } from '../webxr/WebXRController.js';
import { LinearFilter } from '../../constants.js';
import { warn } from '../../utils.js';
import { RenderTarget } from '../../core/RenderTarget.js';

/**
 * The XR manager is built on top of the WebXR Device API to
 * manage XR sessions with renderer backends.
 *
 * @augments EventDispatcher
 */
class XRManager extends EventDispatcher {

	/**
	 * Constructs a new XR manager.
	 *
	 * @param {Renderer} renderer - The renderer.
	 */
	constructor( renderer ) {

		super();

		/**
		 * This flag globally enables XR rendering.
		 *
		 * @type {boolean}
		 * @default false
		 */
		this.enabled = false;

		/**
		 * Whether the XR device is currently presenting or not.
		 *
		 * @type {boolean}
		 * @default false
		 * @readonly
		 */
		this.isPresenting = false;

		/**
		 * Whether the XR camera should automatically be updated or not.
		 *
		 * @type {boolean}
		 * @default true
		 */
		this.cameraAutoUpdate = true;

		/**
		 * The renderer.
		 *
		 * @private
		 * @type {Renderer}
		 */
		this._renderer = renderer;

		// camera

		/**
		 * Represents the camera for the left eye.
		 *
		 * @private
		 * @type {PerspectiveCamera}
		 */
		this._cameraL = new PerspectiveCamera();
		this._cameraL.viewport = new Vector4();
		this._cameraL.matrixWorldAutoUpdate = false;

		/**
		 * Represents the camera for the right eye.
		 *
		 * @private
		 * @type {PerspectiveCamera}
		 */
		this._cameraR = new PerspectiveCamera();
		this._cameraR.viewport = new Vector4();
		this._cameraR.matrixWorldAutoUpdate = false;

		/**
		 * A list of cameras used for rendering the XR views.
		 *
		 * @private
		 * @type {Array<Camera>}
		 */
		this._cameras = [ this._cameraL, this._cameraR ];

		/**
		 * The main XR camera.
		 *
		 * @private
		 * @type {ArrayCamera}
		 */
		this._cameraXR = new ArrayCamera();

		/**
		 * The current near value of the XR camera.
		 *
		 * @private
		 * @type {?number}
		 * @default null
		 */
		this._currentDepthNear = null;

		/**
		 * The current far value of the XR camera.
		 *
		 * @private
		 * @type {?number}
		 * @default null
		 */
		this._currentDepthFar = null;

		/**
		 * A list of WebXR controllers requested by the application.
		 *
		 * @private
		 * @type {Array<WebXRController>}
		 */
		this._controllers = [];

		/**
		 * A list of XR input source. Each input source belongs to
		 * an instance of WebXRController.
		 *
		 * @private
		 * @type {Array<XRInputSource?>}
		 */
		this._controllerInputSources = [];

		/**
		 * The XR render target that represents the rendering destination
		 * during an active XR session.
		 *
		 * @private
		 * @type {?RenderTarget}
		 * @default null
		 */
		this._xrRenderTarget = null;

		/**
		 * Whether the device supports binding WebGPU objects.
		 *
		 * @private
		 * @type {boolean}
		 * @readonly
		 */
		this._supportsWebGPUBinding = typeof globalThis.XRGPUBinding !== 'undefined';

		/**
		 * The current animation context.
		 *
		 * @private
		 * @type {?Window}
		 * @default null
		 */
		this._currentAnimationContext = null;

		/**
		 * The current animation loop.
		 *
		 * @private
		 * @type {?Function}
		 * @default null
		 */
		this._currentAnimationLoop = null;

		/**
		 * The current pixel ratio.
		 *
		 * @private
		 * @type {?number}
		 * @default null
		 */
		this._currentPixelRatio = null;

		/**
		 * The current size of the renderer's canvas
		 * in logical pixel unit.
		 *
		 * @private
		 * @type {Vector2}
		 */
		this._currentSize = new Vector2();

		/**
		 * Holds a reference to the user camera and its current settings.
		 *
		 * @private
		 * @type {?Object}
		 * @default null
		 */
		this._currentCameraSettings = null;

		/**
		 * The default event listener for handling events inside a XR session.
		 *
		 * @private
		 * @type {Function}
		 */
		this._onSessionEvent = onSessionEvent.bind( this );

		/**
		 * The event listener for handling the end of a XR session.
		 *
		 * @private
		 * @type {Function}
		 */
		this._onSessionEnd = onSessionEnd.bind( this );

		/**
		 * The event listener for handling the `inputsourceschange` event.
		 *
		 * @private
		 * @type {Function}
		 */
		this._onInputSourcesChange = onInputSourcesChange.bind( this );

		/**
		 * The animation loop which is used as a replacement for the default
		 * animation loop of the application. It is only used when a XR session
		 * is active.
		 *
		 * @private
		 * @type {Function}
		 */
		this._onAnimationFrame = onAnimationFrame.bind( this );

		/**
		 * The current XR reference space.
		 *
		 * @private
		 * @type {?XRReferenceSpace}
		 * @default null
		 */
		this._referenceSpace = null;

		/**
		 * The current XR reference space type.
		 *
		 * @private
		 * @type {XRReferenceSpaceType}
		 * @default 'local-floor'
		 */
		this._referenceSpaceType = 'local-floor';

		/**
		 * A custom reference space defined by the application.
		 *
		 * @private
		 * @type {?XRReferenceSpace}
		 * @default null
		 */
		this._customReferenceSpace = null;

		/**
		 * The framebuffer scale factor.
		 *
		 * @private
		 * @type {number}
		 * @default 1
		 */
		this._framebufferScaleFactor = 1;

		/**
		 * The foveation factor.
		 *
		 * @private
		 * @type {number}
		 * @default 1
		 */
		this._foveation = 1.0;

		/**
		 * A reference to the current XR session.
		 *
		 * @private
		 * @type {?XRSession}
		 * @default null
		 */
		this._session = null;

		/**
		 * A reference to the current XR WebGPU binding.
		 *
		 * @private
		 * @type {?XRGPUBinding}
		 * @default null
		 */
		this._webgpuBinding = null;

		/**
		 * A reference to the current XR projection layer.
		 *
		 * @private
		 * @type {?XRProjectionLayer}
		 * @default null
		 */
		this._projectionLayer = null;

		/**
		 * A reference to the current XR frame.
		 *
		 * @private
		 * @type {?XRFrame}
		 * @default null
		 */
		this._xrFrame = null;

	}

	/**
	 * Returns an instance of `THREE.Group` that represents the transformation
	 * of a XR controller in target ray space. The requested controller is defined
	 * by the given index.
	 *
	 * @param {number} index - The index of the XR controller.
	 * @return {Group} A group that represents the controller's transformation.
	 */
	getController( index ) {

		const controller = this._getController( index );

		return controller.getTargetRaySpace();

	}

	/**
	 * Returns an instance of `THREE.Group` that represents the transformation
	 * of a XR controller in grip space. The requested controller is defined
	 * by the given index.
	 *
	 * @param {number} index - The index of the XR controller.
	 * @return {Group} A group that represents the controller's transformation.
	 */
	getControllerGrip( index ) {

		const controller = this._getController( index );

		return controller.getGripSpace();

	}

	/**
	 * Returns an instance of `THREE.Group` that represents the transformation
	 * of a XR controller in hand space. The requested controller is defined
	 * by the given index.
	 *
	 * @param {number} index - The index of the XR controller.
	 * @return {Group} A group that represents the controller's transformation.
	 */
	getHand( index ) {

		const controller = this._getController( index );

		return controller.getHandSpace();

	}

	/**
	 * Returns the foveation value.
	 *
	 * @return {number|undefined} The foveation value.
	 */
	getFoveation() {

		return this._foveation;

	}

	/**
	 * Sets the foveation value.
	 *
	 * @param {number} foveation - A number in the range `[0,1]` where `0` means no foveation (full resolution)
	 * and `1` means maximum foveation (the edges render at lower resolution).
	 */
	setFoveation( foveation ) {

		this._foveation = foveation;

		if ( this._projectionLayer !== null ) {

			this._projectionLayer.fixedFoveation = foveation;

		}

	}

	/**
	 * Returns the framebuffer scale factor.
	 *
	 * @return {number} The framebuffer scale factor.
	 */
	getFramebufferScaleFactor() {

		return this._framebufferScaleFactor;

	}

	/**
	 * Sets the framebuffer scale factor.
	 *
	 * This method can not be used during a XR session.
	 *
	 * @param {number} factor - The framebuffer scale factor.
	 */
	setFramebufferScaleFactor( factor ) {

		this._framebufferScaleFactor = factor;

		if ( this.isPresenting === true ) {

			warn( 'XRManager: Cannot change framebuffer scale while presenting.' );

		}

	}

	/**
	 * Returns the reference space type.
	 *
	 * @return {XRReferenceSpaceType} The reference space type.
	 */
	getReferenceSpaceType() {

		return this._referenceSpaceType;

	}

	/**
	 * Sets the reference space type.
	 *
	 * This method can not be used during a XR session.
	 *
	 * @param {XRReferenceSpaceType} type - The reference space type.
	 */
	setReferenceSpaceType( type ) {

		this._referenceSpaceType = type;

		if ( this.isPresenting === true ) {

			warn( 'XRManager: Cannot change reference space type while presenting.' );

		}

	}

	/**
	 * Returns the XR reference space.
	 *
	 * @return {XRReferenceSpace} The XR reference space.
	 */
	getReferenceSpace() {

		return this._customReferenceSpace || this._referenceSpace;

	}

	/**
	 * Sets a custom XR reference space.
	 *
	 * @param {XRReferenceSpace} space - The XR reference space.
	 */
	setReferenceSpace( space ) {

		this._customReferenceSpace = space;

	}

	/**
	 * Returns the XR camera.
	 *
	 * The camera's transformation and projection matrix are derived from the first
	 * sub camera (e.g. the left eye in a stereo setup).
	 *
	 * @return {ArrayCamera} The XR camera.
	 */
	getCamera() {

		return this._cameraXR;

	}

	/**
	 * Returns the environment blend mode from the current XR session.
	 *
	 * @return {'opaque'|'additive'|'alpha-blend'|undefined} The environment blend mode. Returns `undefined` when used outside of a XR session.
	 */
	getEnvironmentBlendMode() {

		if ( this._session !== null ) {

			return this._session.environmentBlendMode;

		}

	}

	/**
	 * Returns the current base layer.
	 *
	 * @return {?XRProjectionLayer} The XR projection layer. Returns `null` when used outside a XR session.
	 */
	getBaseLayer() {

		return this._projectionLayer;

	}

	/**
	 * Returns the current XR WebGPU binding.
	 *
	 * Creates a new binding if needed and the browser is
	 * capable of doing so.
	 *
	 * @return {?XRGPUBinding} The XR WebGPU binding. Returns `null` if one cannot be created.
	 */
	getWebGPUBinding() {

		if ( this._webgpuBinding === null && this._supportsWebGPUBinding ) {

			this._webgpuBinding = new globalThis.XRGPUBinding( this._session, this._renderer.backend.device );

		}

		return this._webgpuBinding;

	}

	/**
	 * Initializes the WebGPU XR projection layer and render target.
	 *
	 * @private
	 * @async
	 * @param {XRSession} session - The XR session.
	 * @return {Promise<void>}
	 */
	async _initWebGPUSession( session ) {

		const webgpuBinding = this.getWebGPUBinding();
		const projectionLayer = webgpuBinding.createProjectionLayer( {
			colorFormat: webgpuBinding.getPreferredColorFormat(),
			scaleFactor: this._framebufferScaleFactor
		} );

		this._projectionLayer = projectionLayer;

		session.updateRenderState( { layers: [ projectionLayer ] } );

		this._referenceSpace = await session.requestReferenceSpace( this.getReferenceSpaceType() );

		this._xrRenderTarget = new RenderTarget( projectionLayer.textureWidth, projectionLayer.textureHeight, {
			depth: 2,
			minFilter: LinearFilter,
			magFilter: LinearFilter,
			depthBuffer: true,
			useArrayDepthTexture: true,
			storeMultisampledColorBuffer: false,
			storeMultisampledDepthBuffer: false,
			storeMultisampledStencilBuffer: false,
			samples: this._renderer.samples
		} );

		this._xrRenderTarget.texture.isArrayTexture = true;

	}

	/**
	 * Releases WebGPU XR resources associated with the current session.
	 *
	 * @private
	 */
	_disposeWebGPUSession() {

		const renderer = this._renderer;
		const backend = renderer.backend;
		const xrRenderTarget = this._xrRenderTarget;

		if ( xrRenderTarget === null ) return;

		if ( renderer._renderContexts && renderer._renderContexts.dispose ) {

			renderer._renderContexts.dispose();

		}

		xrRenderTarget.dispose();

		// The external texture can be registered before the render target is initialized.
		for ( const texture of xrRenderTarget.textures ) {

			if ( backend.has( texture ) ) backend.destroyTexture( texture );

		}

		backend.delete( xrRenderTarget );

	}

	/**
	 * Collects WebGPU XR sub-image data for the current frame.
	 *
	 * @private
	 * @param {Array<XRView>} views - The XR views for the current pose.
	 * @return {{colorTexture:?GPUTexture, viewDescriptors:Array<Object>, viewports:Array<XRViewport>}} The WebGPU XR view data.
	 */
	_getWebGPUViewData( views ) {

		const webgpuBinding = this.getWebGPUBinding();
		const viewData = {
			colorTexture: null,
			viewDescriptors: [],
			viewports: []
		};

		for ( let i = 0; i < views.length; i ++ ) {

			const gpuSubImage = webgpuBinding.getViewSubImage( this._projectionLayer, views[ i ] );

			if ( viewData.colorTexture === null ) {

				viewData.colorTexture = gpuSubImage.colorTexture;

			}

			viewData.viewports.push( gpuSubImage.viewport );

			if ( gpuSubImage.getViewDescriptor ) {

				viewData.viewDescriptors.push( gpuSubImage.getViewDescriptor() );

			}

		}

		return viewData;

	}

	/**
	 * Returns the current XR frame.
	 *
	 * @return {?XRFrame} The XR frame. Returns `null` when used outside a XR session.
	 */
	getFrame() {

		return this._xrFrame;

	}

	/**
	 * Returns the current XR session.
	 *
	 * @return {?XRSession} The XR session. Returns `null` when used outside a XR session.
	 */
	getSession() {

		return this._session;

	}

	/**
	 * After a XR session has been requested usually with one of the `*Button` modules, it
	 * is injected into the renderer with this method. This method triggers the start of
	 * the actual XR rendering.
	 *
	 * @async
	 * @param {XRSession} session - The XR session to set.
	 * @return {Promise} A Promise that resolves when the session has been set.
	 */
	async setSession( session ) {

		const renderer = this._renderer;

		if ( renderer.initialized === false ) await renderer.init();

		if ( session !== null && session.enabledFeatures.includes( 'webgpu' ) === false ) {

			throw new Error( 'THREE.XRManager: XR sessions require the "webgpu" session feature. Request the session with "webgpu" as a required or optional feature, e.g. by using XRButton, VRButton or ARButton.' );

		}

		this._session = session;

		if ( session !== null ) {

			session.addEventListener( 'select', this._onSessionEvent );
			session.addEventListener( 'selectstart', this._onSessionEvent );
			session.addEventListener( 'selectend', this._onSessionEvent );
			session.addEventListener( 'squeeze', this._onSessionEvent );
			session.addEventListener( 'squeezestart', this._onSessionEvent );
			session.addEventListener( 'squeezeend', this._onSessionEvent );
			session.addEventListener( 'end', this._onSessionEnd );
			session.addEventListener( 'inputsourceschange', this._onInputSourcesChange );

			this._currentPixelRatio = renderer.getPixelRatio();
			renderer.getSize( this._currentSize );

			this._currentAnimationContext = renderer._animation.getContext();
			this._currentAnimationLoop = renderer._animation.getAnimationLoop();
			renderer._animation.stop();

			//

			await this._initWebGPUSession( session );

			//

			renderer._animation.setAnimationLoop( this._onAnimationFrame );
			renderer._animation.setContext( session );
			renderer._animation.start();

			this.isPresenting = true;

			this.dispatchEvent( { type: 'sessionstart' } );

		}

	}

	/**
	 * This method is called by the renderer per frame and updates the XR camera
	 * and it sub cameras based on the given camera. The given camera is the "user"
	 * camera created on application level and used for non-XR rendering.
	 *
	 * @param {PerspectiveCamera} camera - The camera.
	 */
	updateCamera( camera ) {

		const session = this._session;

		if ( session === null ) return;

		const depthNear = camera.near;
		const depthFar = camera.far;

		const cameraXR = this._cameraXR;
		const cameraL = this._cameraL;
		const cameraR = this._cameraR;

		cameraXR.near = cameraR.near = cameraL.near = depthNear;
		cameraXR.far = cameraR.far = cameraL.far = depthFar;

		if ( this._currentDepthNear !== cameraXR.near || this._currentDepthFar !== cameraXR.far ) {

			// Note that the new renderState won't apply until the next frame. See #18320

			session.updateRenderState( {
				depthNear: cameraXR.near,
				depthFar: cameraXR.far
			} );

			this._currentDepthNear = cameraXR.near;
			this._currentDepthFar = cameraXR.far;

		}

		// inherit camera layers and enable eye layers (1 = left, 2 = right)
		cameraXR.layers.mask = camera.layers.mask | 0b110;
		cameraL.layers.mask = cameraXR.layers.mask & ~ 0b100;
		cameraR.layers.mask = cameraXR.layers.mask & ~ 0b010;


		const parent = camera.parent;
		const cameras = cameraXR.cameras;

		updateCamera( cameraXR, parent );

		for ( let i = 0; i < cameras.length; i ++ ) {

			updateCamera( cameras[ i ], parent );

		}

		cameraXR.projectionMatrix.copy( cameraL.projectionMatrix );
		cameraXR.projectionMatrixInverse.copy( cameraL.projectionMatrixInverse );

		// update user camera and its children

		if ( this._currentCameraSettings === null && camera.isPerspectiveCamera ) {

			this._currentCameraSettings = { camera: camera, fov: camera.fov, zoom: camera.zoom };

		}

		updateUserCamera( camera, cameraXR, parent );


	}

	/**
	 * Returns a WebXR controller for the given controller index.
	 *
	 * @private
	 * @param {number} index - The controller index.
	 * @return {WebXRController} The XR controller.
	 */
	_getController( index ) {

		let controller = this._controllers[ index ];

		if ( controller === undefined ) {

			controller = new WebXRController();
			this._controllers[ index ] = controller;

		}

		return controller;

	}

}

/**
 * Updates the world matrices for the given camera based on the parent 3D object.
 *
 * @inner
 * @param {Camera} camera - The camera to update.
 * @param {Object3D} parent - The parent 3D object.
 */
function updateCamera( camera, parent ) {

	if ( parent === null ) {

		camera.matrixWorld.copy( camera.matrix );

	} else {

		camera.matrixWorld.multiplyMatrices( parent.matrixWorld, camera.matrix );

	}

	camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

}

/**
 * Updates the given camera with the transformation of the XR camera and parent object.
 *
 * @inner
 * @param {Camera} camera - The camera to update.
 * @param {ArrayCamera} cameraXR - The XR camera.
 * @param {Object3D} parent - The parent 3D object.
 */
function updateUserCamera( camera, cameraXR, parent ) {

	if ( parent === null ) {

		camera.matrix.copy( cameraXR.matrixWorld );

	} else {

		camera.matrix.copy( parent.matrixWorld );
		camera.matrix.invert();
		camera.matrix.multiply( cameraXR.matrixWorld );

	}

	camera.matrix.decompose( camera.position, camera.quaternion, camera.scale );
	camera.updateMatrixWorld( true );

	camera.projectionMatrix.copy( cameraXR.projectionMatrix );
	camera.projectionMatrixInverse.copy( cameraXR.projectionMatrixInverse );

	if ( camera.isPerspectiveCamera ) {

		camera.fov = RAD2DEG * 2 * Math.atan( 1 / camera.projectionMatrix.elements[ 5 ] );
		camera.zoom = 1;

	}

}

function onSessionEvent( event ) {

	const controllerIndex = this._controllerInputSources.indexOf( event.inputSource );

	if ( controllerIndex === - 1 ) {

		return;

	}

	const controller = this._controllers[ controllerIndex ];

	if ( controller !== undefined ) {

		const referenceSpace = this.getReferenceSpace();

		controller.update( event.inputSource, event.frame, referenceSpace );
		controller.dispatchEvent( { type: event.type, data: event.inputSource } );

	}

}

function onSessionEnd() {

	const session = this._session;
	const renderer = this._renderer;

	session.removeEventListener( 'select', this._onSessionEvent );
	session.removeEventListener( 'selectstart', this._onSessionEvent );
	session.removeEventListener( 'selectend', this._onSessionEvent );
	session.removeEventListener( 'squeeze', this._onSessionEvent );
	session.removeEventListener( 'squeezestart', this._onSessionEvent );
	session.removeEventListener( 'squeezeend', this._onSessionEvent );
	session.removeEventListener( 'end', this._onSessionEnd );
	session.removeEventListener( 'inputsourceschange', this._onInputSourcesChange );

	for ( let i = 0; i < this._controllers.length; i ++ ) {

		const inputSource = this._controllerInputSources[ i ];

		if ( inputSource === null ) continue;

		this._controllerInputSources[ i ] = null;

		this._controllers[ i ].disconnect( inputSource );

	}

	this._currentDepthNear = null;
	this._currentDepthFar = null;

	// restore framebuffer/rendering state

	renderer._resetXRState();

	this._disposeWebGPUSession();

	this._session = null;
	this._xrRenderTarget = null;
	this._webgpuBinding = null;
	this._projectionLayer = null;

	this.isPresenting = false;

	renderer._animation.stop();
	renderer._animation.setAnimationLoop( this._currentAnimationLoop );
	renderer._animation.setContext( this._currentAnimationContext );
	renderer._animation.start();

	renderer.setPixelRatio( this._currentPixelRatio );
	renderer.setSize( this._currentSize.width, this._currentSize.height, false );

	if ( this._currentCameraSettings !== null ) {

		const camera = this._currentCameraSettings.camera;

		camera.fov = this._currentCameraSettings.fov;
		camera.zoom = this._currentCameraSettings.zoom;
		camera.updateProjectionMatrix();

		this._currentCameraSettings = null;

	}

	this.dispatchEvent( { type: 'sessionend' } );

}

function onInputSourcesChange( event ) {

	const controllers = this._controllers;
	const controllerInputSources = this._controllerInputSources;

	// Notify disconnected

	for ( let i = 0; i < event.removed.length; i ++ ) {

		const inputSource = event.removed[ i ];
		const index = controllerInputSources.indexOf( inputSource );

		if ( index >= 0 ) {

			controllerInputSources[ index ] = null;
			controllers[ index ].disconnect( inputSource );

		}

	}

	// Notify connected

	for ( let i = 0; i < event.added.length; i ++ ) {

		const inputSource = event.added[ i ];

		let controllerIndex = controllerInputSources.indexOf( inputSource );

		if ( controllerIndex === - 1 ) {

			// Assign input source a controller that currently has no input source

			for ( let i = 0; i < controllers.length; i ++ ) {

				if ( i >= controllerInputSources.length ) {

					controllerInputSources.push( inputSource );
					controllerIndex = i;
					break;

				} else if ( controllerInputSources[ i ] === null ) {

					controllerInputSources[ i ] = inputSource;
					controllerIndex = i;
					break;

				}

			}

			// If all controllers do currently receive input we ignore new ones

			if ( controllerIndex === - 1 ) break;

		}

		const controller = controllers[ controllerIndex ];

		if ( controller ) {

			controller.connect( inputSource );

		}

	}

}

// Animation Loop

function onAnimationFrame( time, frame ) {

	if ( frame === undefined ) return;

	const cameraXR = this._cameraXR;
	const renderer = this._renderer;
	const backend = renderer.backend;

	const referenceSpace = this.getReferenceSpace();
	const pose = frame.getViewerPose( referenceSpace );

	this._xrFrame = frame;

	if ( pose !== null ) {

		const views = pose.views;

		const webgpuViewData = this._getWebGPUViewData( views );

		let cameraXRNeedsUpdate = false;

		// check if it's necessary to rebuild cameraXR's camera list

		if ( views.length !== cameraXR.cameras.length ) {

			cameraXR.cameras.length = 0;
			cameraXRNeedsUpdate = true;

		}

		for ( let i = 0; i < views.length; i ++ ) {

			const view = views[ i ];

			const viewport = webgpuViewData.viewports[ i ];

			let camera = this._cameras[ i ];

			if ( camera === undefined ) {

				camera = new PerspectiveCamera();
				camera.layers.enable( i );
				camera.viewport = new Vector4();
				camera.matrixWorldAutoUpdate = false;
				this._cameras[ i ] = camera;

			}

			camera.matrix.fromArray( view.transform.matrix );
			camera.matrix.decompose( camera.position, camera.quaternion, camera.scale );
			camera.projectionMatrix.fromArray( view.projectionMatrix );
			camera.projectionMatrixInverse.copy( camera.projectionMatrix ).invert();
			camera.viewport.set( viewport.x, viewport.y, viewport.width, viewport.height );

			if ( i === 0 ) {

				cameraXR.matrix.copy( camera.matrix );
				cameraXR.matrix.decompose( cameraXR.position, cameraXR.quaternion, cameraXR.scale );

			}

			if ( cameraXRNeedsUpdate === true ) {

				cameraXR.cameras.push( camera );

			}

		}

		if ( webgpuViewData.colorTexture !== null ) {

			backend.setXRRenderTargetTextures(
				this._xrRenderTarget,
				webgpuViewData.colorTexture,
				webgpuViewData.viewDescriptors
			);

		}

		renderer.setOutputRenderTarget( this._xrRenderTarget );

		const frameBufferTarget = renderer._getFrameBufferTarget();

		this._xrRenderTarget.samples = frameBufferTarget === null ? renderer.samples : 0;
		this._xrRenderTarget.depthBuffer = frameBufferTarget === null;

	}

	//

	for ( let i = 0; i < this._controllers.length; i ++ ) {

		const inputSource = this._controllerInputSources[ i ];
		const controller = this._controllers[ i ];

		if ( inputSource !== null && controller !== undefined ) {

			controller.update( inputSource, frame, referenceSpace );

		}

	}

	if ( this._currentAnimationLoop ) this._currentAnimationLoop( time, frame );

	if ( frame.detectedPlanes ) {

		this.dispatchEvent( { type: 'planesdetected', data: frame } );

	}

	this._xrFrame = null;

}

export default XRManager;
