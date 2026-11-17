import React from 'react';
import { ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { Container, Card, EmptyState, Button, Loading } from '../ui';
import { COLORS } from '../../theme';

/**
 * Renders children only for signed-in, active users with one of `roles`.
 * The database enforces the same rules — this just gives a friendly screen.
 */
export default function StaffGate({ roles, children }) {
  const navigation = useNavigation();
  const { user, loading } = useAuth();

  if (loading) return <Loading />;

  let gate = null;
  if (!user) {
    gate = {
      icon: 'lock-closed-outline',
      title: 'Staff sign-in required',
      message: 'Sign in with your NWSC staff account to continue.',
      action: <Button title="Sign in" icon="log-in-outline" onPress={() => navigation.navigate('Login')} />,
    };
  } else if (!roles.includes(user.role) || user.is_active === false) {
    gate = {
      icon: 'shield-outline',
      title: 'No access',
      message: user.is_active === false
        ? 'Your staff account has been deactivated. Contact an administrator.'
        : `Your account (${user.email}) doesn't have access to this area. Ask an administrator to grant you a staff role.`,
      action: <Button title="Back to home" variant="secondary" onPress={() => navigation.navigate('Home')} />,
    };
  }

  if (gate) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
        <Container narrow style={{ marginTop: 64 }}>
          <Card><EmptyState {...gate} /></Card>
        </Container>
      </ScrollView>
    );
  }
  return children;
}
