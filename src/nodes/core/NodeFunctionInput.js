/**
 * Describes the input of a {@link NodeFunction}.
 */
class NodeFunctionInput {

	/**
	 * Constructs a new node function input.
	 *
	 * @param {string} type - The input type.
	 * @param {string} name - The input name.
	 * @param {?number} [count=null] - If the input is an Array, count will be the length.
	 */
	constructor( type, name, count = null ) {

		/**
		 *  The input type.
		 *
		 * @type {string}
		 */
		this.type = type;

		/**
		 * The input name.
		 *
		 * @type {string}
		 */
		this.name = name;

		/**
		 * If the input is an Array, count will be the length.
		 *
		 * @type {?number}
		 * @default null
		 */
		this.count = count;

	}

}

NodeFunctionInput.isNodeFunctionInput = true;

export default NodeFunctionInput;
