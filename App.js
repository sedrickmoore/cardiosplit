import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Vibration } from 'react-native';
import { Audio } from 'expo-av';

export default function App() {
  const [totalTime, setTotalTime] = useState('30'); // minutes
  const [runTime, setRunTime] = useState('.2'); // minutes
  const [walkTime, setWalkTime] = useState('.2'); // minutes
  const [currentInterval, setCurrentInterval] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPrepping, setIsPrepping] = useState(false);
  const intervalRef = useRef(null);
  const countdownTimersRef = useRef([]);
  const currentIntervalIndex = useRef(0);

  const isPausedRef = useRef(isPaused);
  const currentIntervalRef = useRef(null);

  // Load transition sound
  const soundRef = useRef(null);

  const beep1 = require('./assets/beep1.mp3'); // switch to run
  const beep2 = require('./assets/beep2.mp3'); // countdown from walk
  const beep3 = require('./assets/beep3.mp3'); // switch to walk
  const beep4 = require('./assets/beep4.mp3'); // countdown from run

  useEffect(() => {
    return soundRef.current
      ? () => {
          soundRef.current.unloadAsync();
        }
      : undefined;
  }, []);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    currentIntervalRef.current = currentInterval;
  }, [currentInterval]);

  const playSound = async (soundFile) => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    const { sound } = await Audio.Sound.createAsync(soundFile);
    soundRef.current = sound;
    await sound.playAsync();
  };

  const buildIntervals = (total, run, walk) => {
    const totalSeconds = total * 60;
    const runSeconds = run * 60;
    const walkSeconds = walk * 60;

    const intervals = [];
    let timeRemaining = totalSeconds;

    while (timeRemaining >= runSeconds + walkSeconds) {
      intervals.push({ type: 'Run', duration: runSeconds });
      intervals.push({ type: 'Walk', duration: walkSeconds });
      timeRemaining -= runSeconds + walkSeconds;
    }

    if (timeRemaining >= runSeconds) {
      intervals.push({ type: 'Run', duration: runSeconds });
      timeRemaining -= runSeconds;
    }
    if (timeRemaining > 0) {
      intervals.push({ type: 'Walk', duration: timeRemaining });
    }

    return intervals;
  };

  const preStartCountdown = () => {
    setIsPrepping(true);
    setCurrentInterval({ type: 'Ready', duration: 1 });
    setSecondsLeft(3);
    playSound(beep2);

    setTimeout(() => {
      setCurrentInterval({ type: 'Set', duration: 1 });
      setSecondsLeft(2);
      playSound(beep2);
    }, 1000);

    setTimeout(() => {
      setCurrentInterval({ type: 'Go', duration: 1 });
      setSecondsLeft(1);
      playSound(beep2);
    }, 2000);

    setTimeout(() => {
      setIsPrepping(false);
      startMainTimer();
      playSound(beep1);
    }, 3000);
  };

  const startTimer = () => {
    if (isRunning || isPrepping) return; // prevent duplicate timers
    preStartCountdown();
  };

  const startMainTimer = () => {
    const intervals = buildIntervals(Number(totalTime), Number(runTime), Number(walkTime));
    currentIntervalIndex.current = 0;
    setIsRunning(true);

    const runInterval = () => {
      if (currentIntervalIndex.current >= intervals.length) {
        clearInterval(intervalRef.current);
        setCurrentInterval({ type: 'Done', duration: 0 });
        setIsRunning(false);
        return;
      }
    
      const { type, duration } = intervals[currentIntervalIndex.current];
      setCurrentInterval({ type, duration });
      setSecondsLeft(Math.round(duration)); // round in case of decimal seconds
    };
    
    runInterval();
    
    intervalRef.current = setInterval(() => {
      if (isPausedRef.current) return;
    
      setSecondsLeft((prev) => {
        const newTime = prev - 1;
    
        if (newTime <= 0) {
          Vibration.vibrate(300);
          const nextType = intervals[currentIntervalIndex.current + 1]?.type;
          if (nextType === 'Run') {
            playSound(beep1);
          } else if (nextType === 'Walk') {
            playSound(beep3);
          }
          currentIntervalIndex.current++;
          runInterval();
        } else {
          // Countdown warning
          if (newTime === 3 || newTime === 2 || newTime === 1) {
            const countdownBeep = currentIntervalRef.current?.type === 'Run' ? beep4 : beep2;
            playSound(countdownBeep);
          }
        }
    
        return newTime;
      });
    }, 1000);

  };

  const resetTimer = () => {
    clearInterval(intervalRef.current);
    countdownTimersRef.current.forEach(clearTimeout);
    // Ensure any playing sound is unloaded
    (() => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().then(() => {
          soundRef.current = null;
        });
      }
    })();
    setIsRunning(false);
    setIsPaused(false);
    setIsPrepping(false);
    setSecondsLeft(0);
    setCurrentInterval(null);
    currentIntervalIndex.current = 0;
  };

  return (
    <View style={styles.container}>
      {!isRunning && (
        <>
          <Text style={styles.label}>Total Time (min):</Text>
          <TextInput style={styles.input} value={totalTime} onChangeText={setTotalTime} keyboardType="numeric" />

          <Text style={styles.label}>Run Time (min):</Text>
          <TextInput style={styles.input} value={runTime} onChangeText={setRunTime} keyboardType="numeric" />

          <Text style={styles.label}>Walk Time (min):</Text>
          <TextInput style={styles.input} value={walkTime} onChangeText={setWalkTime} keyboardType="numeric" />

          <Button title="Start Timer" onPress={startTimer} />
        </>
      )}

      {(isRunning || isPrepping) && currentInterval && (
        <View style={styles.timerView}>
          <Text style={styles.phaseText}>{currentInterval.type}</Text>
          <Text style={styles.timeText}>{secondsLeft}s</Text>
        </View>
      )}

      {isRunning && (
        <>
          <Button
            title={isPaused ? "Resume" : "Pause"}
            onPress={() => setIsPaused(!isPaused)}
          />
          <View style={{ marginTop: 10 }}>
            <Button
              title="Stop / Reset"
              onPress={resetTimer}
              color="red"
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 80,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    flex: 1,
  },
  label: {
    fontSize: 18,
    marginTop: 10,
  },
  input: {
    borderBottomWidth: 1,
    fontSize: 18,
    paddingVertical: 4,
    marginBottom: 10,
  },
  timerView: {
    alignItems: 'center',
    marginTop: 100,
  },
  phaseText: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 48,
    fontWeight: 'bold',
    marginTop: 20,
  },
});