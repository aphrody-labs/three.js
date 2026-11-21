*Inheritance: EventDispatcher → Object3D → Group →*

# BundleGroup

A specialized group which enables applications access to the Render Bundle API of WebGPU. The group with all its descendant nodes are considered as one render bundle and processed as such by the renderer.

Only renderable 3D objects are allowed in a bundle group. Other types like lights are not supported and must be added to the scene outside of the group.

## Constructor

### new BundleGroup()

Constructs a new bundle group.

## Properties

### .isBundleGroup : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

### .needsUpdate : boolean

Set this property to `true` when the bundle group has changed.

Default is `false`.

### .static : boolean

Whether the bundle is static or not. When set to `true`, the renderer may skip updating the transformation and material properties of the objects in the bundle until the `needsUpdate` flag is set to `true`. Set it to `false` for bundles with animated objects.

Adding or removing objects always requires setting the `needsUpdate` flag to `true`.

Default is `true`.

**Overrides:** [Group#static](Group.html#static)

### .type : string (readonly)

This property is only relevant for detecting types during serialization/deserialization. It should always match the class name.

Default is `'BundleGroup'`.

**Overrides:** [Group#type](Group.html#type)

### .version : number (readonly)

The bundle group's version.

Default is `0`.

## Source

[src/renderers/common/BundleGroup.js](https://github.com/mrdoob/three.js/blob/master/src/renderers/common/BundleGroup.js)