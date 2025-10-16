import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, TextInput, Button, View, Text, ScrollView, Alert, Animated, Easing } from 'react-native';
import axios from 'axios';
import QRCode from 'react-native-qrcode-svg';
import { OPENAI_API_KEY } from "@env";  // 👈 load from .env

const Coin = () => {
  const [journalText, setJournalText] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [bibleVerse, setBibleVerse] = useState('');
  const [loading, setLoading] = useState(false);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (imageUrl) {
      startRotation();
    }
  }, [imageUrl]);

  const startRotation = () => {
    rotateAnim.setValue(0);
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  };

  const isBibleVersePresent = (text) => {
    const bibleVersePattern = /\b(?:Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms?|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation)\s\d{1,3}:\d{1,3}\b/i;
    const match = text.match(bibleVersePattern);
    return match ? match[0] : null;
  };

  const generateImage = async () => {
    if (!journalText.trim()) {
      Alert.alert('Error', 'Please enter some text');
      return;
    }

    const verse = isBibleVersePresent(journalText);
    if (!verse) {
      Alert.alert('Error', 'Please include a Bible verse in your journal entry');
      return;
    }

    setLoading(true);
    setImageUrl(null);
    setBibleVerse(verse);

    try {
      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true,
      });

      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          prompt: `a holographic 3D medieval coin without any letterings or inscriptions, with a transparent background, in PNG format. Show the coin in 3D format. ${journalText} Date and Time: ${formattedDate}`,
          n: 1,
          size: '512x512',
          response_format: 'url',
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,  // 👈 secure key
            'Content-Type': 'application/json',
          },
        }
      );

      const image = response.data.data[0].url;
      setImageUrl(image);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to generate image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const animatedStyle = {
    transform: [{ rotateY: rotateInterpolate }],
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        <Text style={styles.title}>Journal to Image</Text>
        <TextInput
          style={styles.textInput}
          multiline
          placeholder="Write your journal entry here..."
          value={journalText}
          onChangeText={setJournalText}
        />
        <Button title="Generate Image" onPress={generateImage} />
        {loading && <Text style={styles.loadingText}>Generating image...</Text>}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Animated.Image source={{ uri: imageUrl }} style={[styles.image, animatedStyle]} />
            <View style={styles.qrCodeContainer}>
              <QRCode value={journalText} size={100} />
            </View>
            <Text style={styles.bibleVerse}>{bibleVerse}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  scrollView: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  textInput: {
    width: '100%', height: 150, borderColor: '#ccc', borderWidth: 1,
    borderRadius: 8, padding: 10, marginBottom: 20, textAlignVertical: 'top'
  },
  loadingText: { marginTop: 20, fontSize: 16 },
  imageContainer: { marginTop: 20, alignItems: 'center', perspective: 1000 },
  image: { width: 300, height: 300, resizeMode: 'contain', backgroundColor: 'transparent', backfaceVisibility: 'hidden' },
  qrCodeContainer: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -50 }, { translateY: -50 }] },
  bibleVerse: { marginTop: 20, fontSize: 16, fontStyle: 'italic', textAlign: 'center' },
});

export default Coin;
