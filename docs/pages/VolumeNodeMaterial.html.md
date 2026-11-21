*Inheritance: EventDispatcher → Material → NodeMaterial →*

# VolumeNodeMaterial

Volume node material. Renders a raymarched volume that is only lit by point, spot and rect area lights; directional, ambient and environment lighting are ignored.

If [NodeMaterial#depthNode](NodeMaterial.html#depthNode) is set, it is interpreted as the scene depth used to occlude the rays.

## Constructor

### new VolumeNodeMaterial( parameters : Object )

Constructs a new volume node material.

**parameters**

The configuration parameter.

## Properties

### .isVolumeNodeMaterial : boolean (readonly)

This flag can be used for type testing.

Default is `true`.

### .offsetNode : Node.<float>

Offsets the distance a ray has been traveled through a volume, as a fraction of one raymarching step. Can be used to implement dithering (e.g. per-pixel noise in the range `[0,1)`) to reduce banding.

Default is `null`.

### .scatteringNode : function | FunctionNode

Function used for scattering calculations. It receives `{ positionRay }`, the current ray position in world space, and returns the scattering density for that raymarching step.

Default is `null`.

### .steps : number

Number of steps used for raymarching.

Default is `25`.

## Source

[src/materials/nodes/VolumeNodeMaterial.js](https://github.com/mrdoob/three.js/blob/master/src/materials/nodes/VolumeNodeMaterial.js)