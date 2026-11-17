import React from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Container, Card, EmptyState, Button } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS } from '../theme';

export default function NotFoundScreen() {
  const navigation = useNavigation();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <Container narrow style={{ marginTop: 64 }}>
        <Card>
          <EmptyState
            icon="compass-outline"
            title="We couldn't find that page"
            message="The link may be broken or the page may have moved. Try the home page, or report a problem directly."
            action={<Button title="Go to home page" icon="home-outline" onPress={() => navigation.navigate('Home')} />}
          />
        </Card>
      </Container>
      <Footer />
    </ScrollView>
  );
}
