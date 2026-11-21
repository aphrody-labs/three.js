*Inheritance: EventDispatcher → Material → LineBasicMaterial →*

# LineDashedMaterial

A material for rendering dashed line primitives.

Materials define the appearance of renderable 3D objects.

The material requires the `lineDistance` attribute, so call [Line#computeLineDistances](Line.html#computeLineDistances) on the line. Otherwise, it renders solid.

## Code Example

```js
const material = new THREE.LineDashedMaterial( {
	color: 0xffffff,
	scale: 1,
	dashSize: 3,
	gapSize: 1,
} );
const line = new THREE.Line( geometry, material );
line.computeLineDistances();
```

## Constructor

### new LineDashedMaterial( parameters : Object )

Constructs a new line dashed material.

**parameters**

An object with one or more properties defining the material's appearance. Any property of the material (including any property from inherited materials) can be passed in here. Color values can be passed any type of value accepted by [Color#set](Color.html#set).

## Properties

### .dashSize : number

The length of each dash.

Default is `3`.

### .gapSize : number

The size of the gap.

Default is `1`.

### .isLineDashedMaterial : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

### .scale : number

Scales the line distances before dashing. Values greater than `1` make dashes and gaps shorter.

Default is `1`.

## Source

[src/materials/LineDashedMaterial.js](https://github.com/mrdoob/three.js/blob/master/src/materials/LineDashedMaterial.js)