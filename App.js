import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Vibration,
  TouchableOpacity,
} from "react-native";
import { Audio } from "expo-av";
import {
  useKeepAwake,
  activateKeepAwakeAsync,
  deactivateKeepAwake,
} from "expo-keep-awake";
import { MaterialIcons } from "@expo/vector-icons";
import * as Font from "expo-font";

export default function App() {
  const [totalTime, setTotalTime] = useState("30"); // minutes
  const [runTime, setRunTime] = useState("4"); // minutes
  const [walkTime, setWalkTime] = useState("1"); // minutes
  const [currentInterval, setCurrentInterval] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPrepping, setIsPrepping] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const intervalRef = useRef(null);
  const countdownTimersRef = useRef([]);
  const currentIntervalIndex = useRef(0);

  const isPausedRef = useRef(isPaused);
  const currentIntervalRef = useRef(null);

  // Load transition sound
  const soundRef = useRef(null);
  const silentAudio = useRef(null);

  const beep1 = require("./assets/beep1.mp3"); // switch to run
  const beep2 = require("./assets/beep2.mp3"); // countdown from walk
  const beep3 = require("./assets/beep3.mp3"); // switch to walk
  const beep4 = require("./assets/beep4.mp3"); // countdown from run

  const [fontsLoaded] = Font.useFonts({
    Rajdhani: require("./assets/fonts/Rajdhani-Regular.ttf"),
    RajdhaniBold: require("./assets/fonts/Rajdhani-Bold.ttf"),
  });

  useEffect(() => {
    if (isRunning) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
  }, [isRunning]);

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

  const startSilentAudio = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require("./assets/silence.mp3"),
      {
        isLooping: true,
        shouldPlay: true,
        volume: 0.0,
      }
    );
    silentAudio.current = sound;
    await sound.playAsync();
  };

  const stopSilentAudio = async () => {
    if (silentAudio.current) {
      await silentAudio.current.unloadAsync();
      silentAudio.current = null;
    }
  };

  const buildIntervals = (total, run, walk) => {
    const totalSeconds = total * 60;
    const runSeconds = run * 60;
    const walkSeconds = walk * 60;

    const intervals = [];
    let timeRemaining = totalSeconds;

    while (timeRemaining >= runSeconds + walkSeconds) {
      intervals.push({ type: "Run", duration: runSeconds });
      intervals.push({ type: "Walk", duration: walkSeconds });
      timeRemaining -= runSeconds + walkSeconds;
    }

    if (timeRemaining >= runSeconds) {
      intervals.push({ type: "Run", duration: runSeconds });
      timeRemaining -= runSeconds;
    }
    if (timeRemaining > 0) {
      intervals.push({ type: "Walk", duration: timeRemaining });
    }

    return intervals;
  };

  const preStartCountdown = () => {
    setIsPrepping(true);
    setCurrentInterval({ type: "Ready", duration: 1 });
    setSecondsLeft(3);
    playSound(beep2);

    setTimeout(() => {
      setCurrentInterval({ type: "Set", duration: 1 });
      setSecondsLeft(2);
      playSound(beep2);
    }, 1000);

    setTimeout(() => {
      setCurrentInterval({ type: "Go", duration: 1 });
      setSecondsLeft(1);
      playSound(beep2);
    }, 2000);

    setTimeout(() => {
      setIsPrepping(false);
      startSilentAudio();
      startMainTimer();
      playSound(beep1);
    }, 3000);
  };

  const startTimer = () => {
    if (isRunning || isPrepping) return; // prevent duplicate timers
    preStartCountdown();
  };

  const startMainTimer = () => {
    const intervals = buildIntervals(
      Number(totalTime),
      Number(runTime),
      Number(walkTime)
    );
    currentIntervalIndex.current = 0;
    setIsRunning(true);

    const runInterval = () => {
      if (currentIntervalIndex.current >= intervals.length) {
        clearInterval(intervalRef.current);
        setCurrentInterval({ type: "Done", duration: 0 });
        setIsRunning(false);
        return;
      }

      const { type, duration } = intervals[currentIntervalIndex.current];
      setCurrentInterval({ type, duration });
      currentIntervalRef.current = { type, duration };

      // Trigger vibration immediately for new interval
      if (type === "Run") {
        Vibration.vibrate([0, 500, 0, 500]); // single long buzz for run
      } else if (type === "Walk") {
        Vibration.vibrate([0, 300, 100, 300]); // double buzz for walk
      }

      setSecondsLeft(Math.round(duration));
    };

    runInterval();

    intervalRef.current = setInterval(() => {
      if (isPausedRef.current) return;

      setSecondsLeft((prev) => {
        const newTime = prev - 1;

        if (newTime <= 0) {
          const nextType = intervals[currentIntervalIndex.current + 1]?.type;
          if (nextType === "Run") {
            playSound(beep1);
          } else if (nextType === "Walk") {
            playSound(beep3);
          }
          currentIntervalIndex.current++;
          runInterval();
        } else {
          // Countdown warning
          if (newTime === 3 || newTime === 2 || newTime === 1) {
            const countdownBeep =
              currentIntervalRef.current?.type === "Run" ? beep4 : beep2;
            playSound(countdownBeep);
          }
        }

        return newTime;
      });
      setElapsedTime((et) => et + 1);
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
    stopSilentAudio();
    setIsRunning(false);
    setIsPaused(false);
    setIsPrepping(false);
    setSecondsLeft(0);
    setElapsedTime(0);
    setCurrentInterval(null);
    currentIntervalIndex.current = 0;
  };

  return (
    
    <View
      style={[
        styles.container,
        {
          paddingTop: !isRunning && !isPrepping ? 80 : 0,
          backgroundColor:
            isPaused || !isRunning
              ? "#ffcccc" // soft red
              : currentInterval?.type === "Run"
              ? "#ccffcc" // soft green
              : "#fff8cc", // soft yellow
        },
      ]}
    >
      {!isRunning && !isPrepping && (
        <>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Total Time (min)</Text>
            <TextInput
              style={styles.input}
              value={totalTime}
              onChangeText={setTotalTime}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Run Time (min)</Text>
            <TextInput
              style={styles.input}
              value={runTime}
              onChangeText={setRunTime}
              keyboardType="numeric"
            />

            <Text style={styles.label}>Walk Time (min)</Text>
            <TextInput
              style={styles.input}
              value={walkTime}
              onChangeText={setWalkTime}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.centerContent}>
            <TouchableOpacity style={styles.startButton} onPress={startTimer}>
              <MaterialIcons name="play-arrow" size={64} color="#1B5E20" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {(isRunning || isPrepping) && currentInterval && (
        <View style={styles.timerView}>
          <Text style={styles.phaseText}>{currentInterval.type}</Text>
          {!isPrepping && (
            <Text style={styles.timeText}>
              {Math.floor(secondsLeft / 60)}:
              {(secondsLeft % 60).toString().padStart(2, "0")}
            </Text>
          )}
        </View>
      )}

      {isRunning && (
        <View style={styles.controlButtonsContainer}>
          {!isLocked && (
            <>
              <TouchableOpacity
                style={[styles.controlButton, styles.pauseButton]}
                onPress={() => setIsPaused(!isPaused)}
              >
                <MaterialIcons
                  name={isPaused ? "play-arrow" : "pause"}
                  size={64}
                  color="#996700"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.controlButton, styles.stopButton]}
                onPress={resetTimer}
              >
                <MaterialIcons name="stop" size={64} color="#8B0000" />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: "darkgoldenrod" }]}
            onLongPress={() => setIsLocked(!isLocked)}
            delayLongPress={1000}
          >
            <MaterialIcons
              name={isLocked ? "lock" : "lock-open"}
              size={48}
              color="black"
            />
          </TouchableOpacity>
          <Text style={styles.elapsedText}>
            {Math.floor(elapsedTime / 60)}:
            {(elapsedTime % 60).toString().padStart(2, "0")}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 0,
    paddingHorizontal: 20,
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: 42,
    marginTop: 10,
    color: "#ffcccc",
    marginBottom: 15,
    textAlign: "center",
    fontFamily: "RajdhaniBold",
  },
  inputContainer: {
    backgroundColor: "#800000",
    padding: 20,
    borderRadius: 16,
    marginTop: 40,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    width: "100%",
    alignSelf: "center",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    padding: 10,
    fontSize: 42,
    marginBottom: 15,
    backgroundColor: "#ffcccc",
    width: 180,
    textAlign: "center",
    fontFamily: "RajdhaniBold",
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  timerView: {
    alignItems: "center",
    marginTop: 100,
  },
  phaseText: {
    fontSize: 72,
    // fontWeight: 'bold',
    fontFamily: "RajdhaniBold",
  },
  timeText: {
    fontSize: 72,
    // fontWeight: 'bold',
    marginTop: 20,
    fontFamily: "RajdhaniBold",
  },
  elapsedText: {
    fontSize: 72,
    // marginTop: 20,
    // fontWeight: 'bold',
    color: "#222",
    fontFamily: "RajdhaniBold",
  },
  startButton: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    backgroundColor: "#81C784", // darker green
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  startButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  controlButtonsContainer: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 30,
    marginTop: 60,
    width: "100%",
  },
  controlButton: {
    width: "100%",
    height: 150,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  pauseButton: {
    backgroundColor: "#FFD54F", // darker yellow
  },
  stopButton: {
    backgroundColor: "#EF9A9A", // darker red
  },
  controlButtonText: {
    color: "white",
    fontSize: 18,
    // fontWeight: 'bold',
    fontFamily: "RajdhaniBold",
  },
});
