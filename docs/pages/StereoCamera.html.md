# StereoCamera

A special type of camera that uses two perspective cameras with stereoscopic projection. Can be used for rendering stereo effects like [3D Anaglyph](https://en.wikipedia.org/wiki/Anaglyph_3D) or [Parallax Barrier](https://en.wikipedia.org/wiki/parallax_barrier).

## Constructor

### new StereoCamera()

Constructs a new stereo camera.

## Properties

### .aspect : number

The aspect.

Default is `1`.

### .cameraL : PerspectiveCamera

The camera representing the left eye. It has layer `1` enabled in addition to the default layer `0`, so objects only on layer `1` are rendered by the left camera only.

### .cameraR : PerspectiveCamera

The camera representing the right eye. It has layer `2` enabled in addition to the default layer `0`, so objects only on layer `2` are rendered by the right camera only.

### .eyeSep : number

The eye separation which represents the distance between the left and right camera.

Default is `0.064`.

### .type : string (readonly)

The type property is used for detecting the object type in context of serialization/deserialization.

## Methods

### .update( camera : PerspectiveCamera )

Updates the stereo camera based on the given perspective camera.

**camera**

The perspective camera.

## Source

[src/cameras/StereoCamera.js](https://github.com/mrdoob/three.js/blob/master/src/cameras/StereoCamera.js)