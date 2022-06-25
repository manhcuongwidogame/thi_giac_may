import logo from './logo.svg';
import './App.css';
import { Howl, Howler } from 'howler';
import React, { useEffect, useRef, useState } from 'react';
import { cleanup } from '@testing-library/react';
import { initNotifications, notify } from '@mycv/f8-notification';
import soundURL from './assets/hey_sondn.mp3'

var sound = new Howl({
  src: [soundURL]
});

const NOT_TOUCH_LABEL = 'not_touch';
const TOUCHED_LABEL = 'touched';
const TRAINING_TIMES = 50;
const TOUCH_CONFIDENCE = 0.8;

function App() {
  const video = useRef();
  const tf = useRef();
  const mobilenetModule = useRef();
  const knnClassifier = useRef();
  const canPlaySound = useRef(true);

  const [touched, setTouched] = useState(false);

  const classifier = useRef();
  const mobilenet = useRef();

  const init = async () => {
    console.log('init...');
    await setupCamera();
    console.log('success...');

    tf.current = require('@tensorflow/tfjs');
    mobilenetModule.current = require('@tensorflow-models/mobilenet');
    knnClassifier.current = require('@tensorflow-models/knn-classifier');


    classifier.current = knnClassifier.current.create();
    mobilenet.current = await mobilenetModule.current.load();
    console.log('Dont touch your face an click Train 1');

    initNotifications({ cooldown: 3000 });
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          stream => {
            video.current.srcObject = stream
            video.current.addEventListener('loadeddata', resolve)
          },
          error => reject(error)
        )
      } else {
        reject();
      }
    });
  }

  const train = async label => {
    console.log(`[${label}] Loading data for PC...`)
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      console.log(`Progress ${parseInt((i + 1) / TRAINING_TIMES * 100)}%`)

      await training(label);
    }
  }

  /**
   * Step1: Training face not touch 50 times
   * Step2: Training face touched 50 times
   * Step3: Get image, compare with data
   * ==> If match with touch_face => WARNING
   * @param {*} label 
   * @returns 
   */

  const training = label => {
    return new Promise(async resolve => {
      const embedding = mobilenet.current.infer(
        video.current,
        true
      );
      classifier.current.addExample(embedding, label);
      await sleep(100);
      resolve();
    });
  }

  const run = async () => {
    const embedding = mobilenet.current.infer(
      video.current,
      true
    );
    const result = await classifier.current.predictClass(embedding);

    if (
      result.label == TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCH_CONFIDENCE
    ) {
      console.log('Touched');
      if (canPlaySound.current) {
        canPlaySound.current = false;
        sound.play();
      }

      notify("Don't touch your face", { body: 'You have touched your face.' });
      setTouched(true);
    } else {
      console.log('Not Touch');
      setTouched(false)
    }

    await sleep(200);

    run();
  }

  const sleep = (ms = 0) => {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  useEffect(() => {
    init();

    sound.on('end', function () {
      canPlaySound.current = true;
    });

    // cleanup
    return () => {

    }
  }, []);

  return (
    <div className={`main ${touched ? 'touched' : ''}`}>
      <video
        ref={video}
        className='video'
        autoPlay
      />

      <div className='control'>
        <button className='btn' onClick={() => train(NOT_TOUCH_LABEL)}>Train 1</button>
        <button className='btn' onClick={() => train(TOUCHED_LABEL)}>Train 2</button>
        <button className='btn' onClick={() => run()}>Run</button>
      </div>
    </div>
  );
}

export default App;
