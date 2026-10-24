import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import { Account, deleteAccount, loadAccounts, saveAccount } from './storage';
import { fromManual, generate, parseUri, secondsLeft, toUri } from './totp';

type Screen = 'list' | 'scan' | 'manual';

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [screen, setScreen] = useState<Screen>('list');
  const [unlocked, setUnlocked] = useState(false);
  const now = useNow();

  // Secrets are only read from secure storage after the user authenticates, and dropped from memory on lock.
  async function unlock() {
    if ((await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) {
      Alert.alert('No screen lock', 'Set a PIN, pattern or biometric on this device to protect your codes.');
    } else {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Taller MFA' });
      if (!result.success) return;
    }
    try {
      setAccounts(await loadAccounts());
      setUnlocked(true);
    } catch (e) {
      Alert.alert('Storage error', String(e));
    }
  }

  useEffect(() => {
    unlock();
    // Lock when the app goes to the background; ask again when it comes back.
    // 'inactive' is ignored: iOS reports it while the Face ID prompt itself is showing.
    let wasBackground = false;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        wasBackground = true;
        setUnlocked(false);
        setAccounts([]);
        setScreen('list');
      } else if (state === 'active' && wasBackground) {
        wasBackground = false;
        unlock();
      }
    });
    return () => sub.remove();
  }, []);

  if (!unlocked) {
    return (
      <SafeAreaView style={[s.screen, s.center]}>
        <StatusBar style="dark" />
        <Text style={s.title}>Taller MFA is locked</Text>
        <Button label="Unlock" onPress={unlock} />
      </SafeAreaView>
    );
  }

  async function add(uri: string) {
    setAccounts(await saveAccount(accounts, uri));
    setScreen('list');
  }

  if (screen === 'scan') return <Scanner onUri={add} onCancel={() => setScreen('list')} />;
  if (screen === 'manual') return <ManualEntry onUri={add} onCancel={() => setScreen('list')} />;

  return (
    <SafeAreaView style={s.screen}>
      <StatusBar style="dark" />
      <Text style={s.title}>Authenticator</Text>
      <FlatList
        data={accounts}
        keyExtractor={(a) => a.id}
        ListEmptyComponent={<Text style={s.muted}>No accounts yet. Scan a QR code to add one.</Text>}
        renderItem={({ item }) => (
          <AccountRow
            account={item}
            now={now}
            onDelete={() =>
              Alert.alert('Delete account?', 'You will lose access to codes for this service.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => setAccounts(await deleteAccount(accounts, item.id)) },
              ])
            }
          />
        )}
      />
      <View style={s.row}>
        <Button label="Scan QR" onPress={() => setScreen('scan')} />
        <Button label="Enter key" onPress={() => setScreen('manual')} />
      </View>
    </SafeAreaView>
  );
}

// Re-renders every second so codes and countdowns stay current.
function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function AccountRow({ account, now, onDelete }: { account: Account; now: number; onDelete: () => void }) {
  const totp = parseUri(account.uri);
  const code = generate(totp, now);
  const left = secondsLeft(totp.period, now);

  return (
    <Pressable
      style={s.card}
      onPress={() => Clipboard.setStringAsync(code).then(() => Alert.alert('Copied', `${code} copied to clipboard`))}
      onLongPress={onDelete}
      accessibilityHint="Tap to copy, long press to delete"
    >
      <Text style={s.issuer}>{totp.issuer || 'Unknown'} · {totp.label}</Text>
      <View style={s.row}>
        <Text style={[s.code, left <= 5 && s.expiring]}>{code.slice(0, code.length / 2)} {code.slice(code.length / 2)}</Text>
        <Text style={s.muted}>{left}s</Text>
      </View>
      <View style={s.bar}><View style={[s.barFill, { width: `${(left / totp.period) * 100}%` }]} /></View>
    </Pressable>
  );
}

function Scanner({ onUri, onCancel }: { onUri: (uri: string) => void; onCancel: () => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false); // scanner fires many events per second; act on first only

  if (!permission) return <View style={s.screen} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={s.screen}>
        <Text style={s.muted}>Camera access is needed to scan QR codes.</Text>
        <View style={s.row}>
          <Button label="Allow camera" onPress={requestPermission} />
          <Button label="Cancel" onPress={onCancel} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          handled.current = true;
          try {
            onUri(toUri(parseUri(data)));
          } catch (e) {
            Alert.alert('Not an authenticator QR', String((e as Error).message), [{ text: 'OK', onPress: () => (handled.current = false) }]);
          }
        }}
      />
      <SafeAreaView style={s.overlay}>
        <Button label="Cancel" onPress={onCancel} />
      </SafeAreaView>
    </View>
  );
}

function ManualEntry({ onUri, onCancel }: { onUri: (uri: string) => void; onCancel: () => void }) {
  const [issuer, setIssuer] = useState('');
  const [label, setLabel] = useState('');
  const [key, setKey] = useState('');

  function submit() {
    try {
      onUri(toUri(fromManual(issuer.trim(), label.trim(), key)));
    } catch (e) {
      Alert.alert('Invalid input', (e as Error).message);
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <Text style={s.title}>Enter setup key</Text>
      <TextInput style={s.input} placeholder="Service (e.g. TallerMFA)" value={issuer} onChangeText={setIssuer} />
      <TextInput style={s.input} placeholder="Account (e.g. alice)" value={label} onChangeText={setLabel} autoCapitalize="none" />
      <TextInput style={s.input} placeholder="Setup key" value={key} onChangeText={setKey} autoCapitalize="characters" autoCorrect={false} secureTextEntry />
      <View style={s.row}>
        <Button label="Add" onPress={submit} />
        <Button label="Cancel" onPress={onCancel} />
      </View>
    </SafeAreaView>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={s.button} onPress={onPress} accessibilityRole="button">
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: '#f6f7f9' },
  center: { justifyContent: 'center', alignItems: 'stretch' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 16 },
  muted: { color: '#666', marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  issuer: { color: '#444', fontSize: 15 },
  code: { fontSize: 36, fontWeight: '600', letterSpacing: 2, color: '#1a56db', fontVariant: ['tabular-nums'] },
  expiring: { color: '#c81e1e' },
  bar: { height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, marginTop: 8 },
  barFill: { height: 4, backgroundColor: '#1a56db', borderRadius: 2 },
  button: { flex: 1, backgroundColor: '#1a56db', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  input: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 16 },
  overlay: { position: 'absolute', bottom: 0, left: 16, right: 16 },
});
