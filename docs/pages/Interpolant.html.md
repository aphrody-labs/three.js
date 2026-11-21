# Interpolant

Abstract base class of interpolants over parametric samples.

The parameter domain is one dimensional, typically the time or a path along a curve defined by the data.

The sample values can have any dimensionality and derived classes may apply special interpretations to the data.

This class provides the interval seek in a Template Method, deferring the actual interpolation to derived classes.

Time complexity is O(1) for linear access crossing at most two points and O(log N) for random access, where N is the number of positions.

References: [http://www.oodesign.com/template-method-pattern.html](http://www.oodesign.com/template-method-pattern.html)

## Constructor

### new Interpolant( parameterPositions : TypedArray, sampleValues : TypedArray, sampleSize : number, resultBuffer : TypedArray ) (abstract)

Constructs a new interpolant.

**parameterPositions**

The ascending parameter positions of the samples, e.g. keyframe times.

**sampleValues**

The sample values.

**sampleSize**

The sample size

**resultBuffer**

The result buffer.

## Properties

### .DefaultSettings_ : Object

The default settings object.

### .parameterPositions : TypedArray

The parameter positions.

### .resultBuffer : TypedArray

The result buffer.

### .sampleValues : TypedArray

The sample values.

### .settings : Object

The interpolation settings.

Default is `null`.

### .valueSize : number

The value size.

## Methods

### .copySampleValue_( index : number ) : TypedArray

Copies a sample value to the result buffer.

**index**

An index into the sample value buffer.

**Returns:** The result buffer.

### .evaluate( t : number ) : TypedArray

Evaluate the interpolant at position `t`.

**t**

The parameter position (e.g. time) at which to evaluate.

**Returns:** The result buffer.

### .getSettings_() : Object

Returns the interpolation settings.

**Returns:** The interpolation settings.

### .interpolate_( i1 : number, t0 : number, t : number, t1 : number ) : TypedArray (abstract)

Interpolates between the samples at `i1 - 1` and `i1` and writes the result to the result buffer.

**i1**

An index into the sample value buffer.

**t0**

The previous parameter position.

**t**

The current parameter position.

**t1**

The next parameter position.

**Returns:** The result buffer.

### .intervalChanged_( i1 : number, t0 : number, t1 : number )

Optional method that is executed when the interval has changed.

**i1**

An index into the sample value buffer.

**t0**

The previous parameter position.

**t1**

The next parameter position.

## Source

[src/math/Interpolant.js](https://github.com/mrdoob/three.js/blob/master/src/math/Interpolant.js)