import Renderer from '../common/Renderer.js';
import WebGPUBackend from './WebGPUBackend.js';
import StandardNodeLibrary from './nodes/StandardNodeLibrary.js';
/*
const debugHandler = {

	get: function ( target, name ) {

		// Add |update
		if ( /^(create|destroy)/.test( name ) ) log( 'WebGPUBackend.' + name );

		return target[ name ];

	}

};
*/

/**
 * This renderer targets the WebGPU API.
 *
 * The renderer initializes asynchronously: call `await renderer.init()` before using
 * `render()`, or define the animation loop with `setAnimationLoop()` which waits for
 * the initialization.
 *
 * @augments Renderer
 */
class WebGPURenderer extends Renderer {

	/**
	 * WebGPURenderer options.
	 *
	 * @typedef {Object} WebGPURenderer~Options
	 * @property {boolean} [logarithmicDepthBuffer=false] - Whether logarithmic depth buffer is enabled or not. Ignored when a reversed depth buffer is in use.
	 * @property {boolean} [reversedDepthBuffer=false] - Whether reversed depth buffer is enabled or not.
	 * @property {boolean} [alpha=true] - Whether the default framebuffer (which represents the final contents of the canvas) should be transparent or opaque.
	 * @property {boolean} [depth=true] - Whether the default framebuffer should have a depth buffer or not.
	 * @property {boolean} [stencil=false] - Whether the default framebuffer should have a stencil buffer or not.
	 * @property {boolean} [antialias=false] - Whether MSAA as the default anti-aliasing should be enabled or not. MSAA is disabled on devices
	 * running in WebGPU compatibility mode.
	 * @property {number} [samples=0] - The number of MSAA samples. When `antialias` is `true`, `4` samples are used by default. A value other than `0`
	 * overwrites the default and enables MSAA even without `antialias`. The WebGPU backend only supports `4` samples (higher values are
	 * clamped to `4`).
	 * @property {HTMLCanvasElement|OffscreenCanvas} [canvas] - The canvas the renderer draws its output to. If not provided, a new canvas is created.
	 * @property {GPUCanvasContext} [context] - An existing rendering context of `canvas`.
	 * @property {string} [powerPreference] - A hint for the GPU adapter selection, either `'low-power'` or `'high-performance'`.
	 * @property {Object} [requiredLimits={}] - The device limits to request. If the adapter cannot provide them, the initialization fails.
	 * @property {GPUDevice} [device] - An existing GPU device to use instead of requesting a new one. `powerPreference` and `requiredLimits`
	 * are ignored in this case, and the device is not destroyed when the renderer is disposed.
	 * @property {number} [outputType=undefined] - Texture type for output to canvas. Either `UnsignedByteType` or `HalfFloatType` (extended range,
	 * for HDR displays); other types are not supported. By default, device's preferred format is used; other formats may incur overhead.
	 * @property {number} [outputBufferType=HalfFloatType] - Defines the type of output buffers. The default `HalfFloatType` is recommend for best
	 * quality. To save memory and bandwidth, `UnsignedByteType` might be used. This will reduce rendering quality though.
	 */

	/**
	 * Constructs a new WebGPU renderer.
	 *
	 * @param {WebGPURenderer~Options} [parameters] - The configuration parameter.
	 */
	constructor( parameters = {} ) {

		const backend = new WebGPUBackend( parameters );

		//super( new Proxy( backend, debugHandler ) );
		super( backend, parameters );

		/**
		 * The generic default value is overwritten with the
		 * standard node library for type mapping.
		 *
		 * @type {StandardNodeLibrary}
		 */
		this.library = new StandardNodeLibrary();

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isWebGPURenderer = true;

		if ( typeof __THREE_DEVTOOLS__ !== 'undefined' ) {

			__THREE_DEVTOOLS__.dispatchEvent( new CustomEvent( 'observe', { detail: this } ) );

		}

	}

}

export default WebGPURenderer;
