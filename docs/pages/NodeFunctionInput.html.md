# NodeFunctionInput

Describes the input of a [NodeFunction](NodeFunction.html).

## Constructor

### new NodeFunctionInput( type : string, name : string, count : number )

Constructs a new node function input.

**type**

The input type.

**name**

The input name.

**count**

If the input is an Array, count will be the length.

Default is `null`.

## Properties

### .count : number

If the input is an Array, count will be the length.

Default is `null`.

### .name : string

The input name.

### .type : string

The input type.

## Source

[src/nodes/core/NodeFunctionInput.js](https://github.com/mrdoob/three.js/blob/master/src/nodes/core/NodeFunctionInput.js)