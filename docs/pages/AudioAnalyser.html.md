# AudioAnalyser

This class can be used to analyse audio data.

## Code Example

```js
// create an AudioListener and add it to the camera
const listener = new THREE.AudioListener();
camera.add( listener );
// create an Audio source
const sound = new THREE.Audio( listener );
// load a sound and set it as the Audio object's buffer
const audioLoader = new THREE.AudioLoader();
audioLoader.load( 'sounds/ambient.ogg', function( buffer ) {
	sound.setBuffer( buffer );
	sound.setLoop(true);
	sound.setVolume(0.5);
	sound.play();
});
// create an AudioAnalyser, passing in the sound and desired fftSize
const analyser = new THREE.AudioAnalyser( sound, 32 );
// get the average magnitude of the frequency data
const data = analyser.getAverageFrequency();
```

## Constructor

### new AudioAnalyser( audio : Audio, fftSize : number )

Constructs a new audio analyzer.

**audio**

The audio to analyze.

**fftSize**

The window size in samples that is used when performing a Fast Fourier Transform (FFT) to get frequency domain data.

Default is `2048`.

## Properties

### .analyser : AnalyserNode

The native analyser node used to compute the frequency data.

### .data : Uint8Array

Holds the analyzed data.

## Methods

### .getAverageFrequency() : number

Returns the average of the frequency data returned by [AudioAnalyser#getFrequencyData](AudioAnalyser.html#getFrequencyData), i.e. the mean magnitude across all frequency bins.

**Returns:** The average magnitude in the range `[0, 255]`.

### .getFrequencyData() : Uint8Array

Returns an array with frequency data of the audio.

Each item in the array is an unsigned byte in the range `[0, 255]`, linearly mapped from `analyser.minDecibels` to `analyser.maxDecibels`. Item `k` represents the frequency `k * sampleRate / fftSize`, so the frequencies are spread linearly from `0` up to just below half the sample rate.

**Returns:** The frequency data.

## Source

[src/audio/AudioAnalyser.js](https://github.com/mrdoob/three.js/blob/master/src/audio/AudioAnalyser.js)