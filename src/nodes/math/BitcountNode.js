import { nodeProxyAssignable } from '../tsl/TSLCore.js';
import MathNode from './MathNode.js';

/**
 * This node represents an operation that counts the bits of a piece of shader data.
 *
 * @augments MathNode
 */
class BitcountNode extends MathNode {

	static get type() {

		return 'BitcountNode';

	}

	/**
	 * Constructs a new bitcount node.
	 *
	 * @param {'countTrailingZeros'|'countLeadingZeros'|'countOneBits'} method - The method name.
	 * @param {Node} aNode - The first input.
	 */
	constructor( method, aNode ) {

		super( method, aNode );

		/**
		 * This flag can be used for type testing.
		 *
		 * @type {boolean}
		 * @readonly
		 * @default true
		 */
		this.isBitcountNode = true;

	}

	static get COUNT_TRAILING_ZEROS() {

		return 'countTrailingZeros';

	}

	static get COUNT_LEADING_ZEROS() {

		return 'countLeadingZeros';

	}

	static get COUNT_ONE_BITS() {

		return 'countOneBits';

	}

}

export default BitcountNode;

/**
 * Finds the number of consecutive 0 bits from the least significant bit of the input value,
 * which is also the index of the least significant bit of the input value.
 *
 * @tsl
 * @function
 * @param {Node | number} x - The input value.
 * @returns {Node}
 */
export const countTrailingZeros = /*@__PURE__*/ nodeProxyAssignable( BitcountNode, BitcountNode.COUNT_TRAILING_ZEROS ).setParameterLength( 1 );

/**
 * Finds the number of consecutive 0 bits starting from the most significant bit of the input value.
 *
 * @tsl
 * @function
 * @param {Node | number} x - The input value.
 * @returns {Node}
 */
export const countLeadingZeros = /*@__PURE__*/ nodeProxyAssignable( BitcountNode, BitcountNode.COUNT_LEADING_ZEROS ).setParameterLength( 1 );

/**
 * Finds the number of '1' bits set in the input value
 *
 * @tsl
 * @function
 * @param {Node | number} x - The input value.
 * @returns {Node}
 */
export const countOneBits = /*@__PURE__*/ nodeProxyAssignable( BitcountNode, BitcountNode.COUNT_ONE_BITS ).setParameterLength( 1 );
