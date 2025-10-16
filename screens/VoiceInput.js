import React, { useEffect, useState } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Text,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { Audio } from "expo-audio";  // ✅ instead of expo-audio
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from 'expo-speech';
import { GiftedChat } from 'react-native-gifted-chat';
import { MaterialIcons } from '@expo/vector-icons';
import { OPENAI_API_KEY, GOOGLE_API_KEY, WEATHER_API_KEY } from '@env'; // 👈 load from .env

const VoiceInput = () => {
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    const getPermission = async () => {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Mic permission denied');
      }
    };
    getPermission();
  }, []);

  const startRecording = async () => {
    try {
      setError('');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      setError('Failed to start recording: ' + err.message);
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      transcribeAudio(uri);
      setRecording(null);
    } catch (err) {
      setError('Failed to stop recording: ' + err.message);
    }
  };

  const transcribeAudio = async (uri) => {
    try {
      const audioFile = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      const response = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: {
              encoding: 'WEBM_OPUS',
              sampleRateHertz: 48000,
              languageCode: 'en-US',
            },
            audio: { content: audioFile },
          }),
        }
      );

      const result = await response.json();

      if (result.results && result.results.length > 0) {
        const transcriptText = result.results
          .map((res) => res.alternatives[0].transcript)
          .join('\n')
          .toLowerCase();

        setTranscript(transcriptText);

        if (transcriptText.includes('hey jarvis')) {
          const cleanedQuery = transcriptText.replace(/hey jarvis/i, '').trim();
          onSend([
            {
              text: cleanedQuery || 'Hey Jarvis',
              user: { _id: 1 },
              createdAt: new Date(),
              _id: Date.now(),
            },
          ]);
        } else {
          setError('Wake word "Hey Jarvis" not detected.');
        }
      } else {
        setError('No transcription results.');
      }
    } catch (err) {
      setError('Transcription failed: ' + err.message);
    }
  };

  const onSend = async (newMessages = []) => {
    setMessages((prev) => GiftedChat.append(prev, newMessages));
    const userMessage = newMessages[0].text;

    if (userMessage.toLowerCase().includes('weather')) {
      fetchWeather(userMessage);
    } else if (
      userMessage.toLowerCase().includes('image') ||
      userMessage.toLowerCase().includes('draw')
    ) {
      generateImage(userMessage);
    } else {
      generateTextResponse(userMessage);
    }
  };

  const generateTextResponse = async (message) => {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: message }],
        }),
      });

      const data = await response.json();
      const reply = data.choices[0].message.content;

      const botMessage = {
        _id: Date.now() + 1,
        text: reply,
        createdAt: new Date(),
        user: { _id: 2, name: 'ChatGPT' },
      };

      setMessages((prev) => GiftedChat.append(prev, [botMessage]));
      setIsSpeaking(true);
      Speech.speak(reply, {
        language: 'en-US',
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
      });
    } catch (err) {
      setError('ChatGPT error: ' + err.message);
    }
  };

  const generateImage = async (prompt) => {
    try {
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          prompt,
          n: 1,
          size: '512x512',
        }),
      });

      const data = await response.json();

      const imageMessage = {
        _id: Date.now() + 2,
        image: data.data[0].url,
        createdAt: new Date(),
        user: { _id: 2, name: 'ImageBot' },
      };

      setMessages((prev) => GiftedChat.append(prev, [imageMessage]));
    } catch (err) {
      setError('Image error: ' + err.message);
    }
  };

  const fetchWeather = async (message) => {
    try {
      const city = message.split('in ').pop().trim();
      const response = await fetch(
        `http://api.weatherstack.com/current?access_key=${WEATHER_API_KEY}&query=${city}`
      );
      const weatherData = await response.json();
      if (weatherData && weatherData.current) {
        const weatherText = `Weather in ${city}: ${weatherData.current.weather_descriptions[0]}, ${weatherData.current.temperature}°C.`;

        const weatherMessage = {
          _id: Date.now() + 3,
          text: weatherText,
          createdAt: new Date(),
          user: { _id: 2, name: 'WeatherBot' },
        };

        setMessages((prev) => GiftedChat.append(prev, [weatherMessage]));
        setIsSpeaking(true);
        Speech.speak(weatherText, {
          language: 'en-US',
          onDone: () => setIsSpeaking(false),
          onStopped: () => setIsSpeaking(false),
        });
      } else {
        throw new Error('Invalid weather data.');
      }
    } catch (err) {
      setError('Weather fetch failed: ' + err.message);
    }
  };

  const stopSpeaking = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <GiftedChat
        messages={messages}
        user={{ _id: 1 }}
        renderInputToolbar={() => null}
      />

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type or speak..."
          value={inputMessage}
          onChangeText={setInputMessage}
        />
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={[styles.iconButton, { backgroundColor: isRecording ? 'red' : 'blue' }]}
        >
          <MaterialIcons name="mic" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (inputMessage.trim() !== '') {
              onSend([{ text: inputMessage, user: { _id: 1 }, createdAt: new Date(), _id: Date.now() }]);
              setInputMessage('');
            }
          }}
          style={styles.iconButton}
        >
          <MaterialIcons name="send" size={34} color="green" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={stopSpeaking}
          style={[styles.iconButton, { backgroundColor: 'orange' }]}
        >
          <MaterialIcons name="stop" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {error ? <Text style={{ color: 'red', textAlign: 'center' }}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    backgroundColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    height: 48,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 30,
  },
  iconButton: {
    padding: 10,
    marginLeft: 5,
    borderRadius: 50,
    marginBottom: 30,
  },
});

export default VoiceInput;
