*Inheritance: EventDispatcher → Node → LightingNode →*

# OcclusionAwareIrradianceNode

A generic class that can be used by nodes which contribute irradiance that already accounts for ambient occlusion, e.g. global illumination. Unlike [IrradianceNode](IrradianceNode.html), the contribution is not modulated by the ambient occlusion of the lighting model. Used in [NodeMaterial](NodeMaterial.html).

## Constructor

### new OcclusionAwareIrradianceNode( node : Node.<vec3> )

Constructs a new occlusion-aware irradiance node.

**node**

A node contributing irradiance that accounts for ambient occlusion.

## Properties

### .node : Node.<vec3>

A node contributing irradiance that accounts for ambient occlusion.

## Source

[src/nodes/lighting/OcclusionAwareIrradianceNode.js](https://github.com/mrdoob/three.js/blob/master/src/nodes/lighting/OcclusionAwareIrradianceNode.js)