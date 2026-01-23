import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useAuth } from "@/hooks/useAuth";
import { colors } from "@/styles/colors";
import { router } from "expo-router";
import { Eye, EyeOff, Lock, Mail, Plane } from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function SignIn() {
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSignIn() {
    try {
      setLoading(true);
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert("Login", error?.message ?? "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView
      enableOnAndroid
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="flex-1 items-center px-5">
        <View className="items-center justify-center flex-1 w-full">
          <Image
            source={require("@/assets/icon.png")}
            className="w-28 h-28"
            resizeMode="contain"
          />

          <Image source={require("@/assets/bg.png")} className="absolute" />

          <Text className="text-zinc-100 font-bold text-3xl mt-3">
            Bem-vindo!
          </Text>

          <Text className="text-zinc-400 text-center text-lg my-5">
            Planeje viagens incríveis com seus amigos.
          </Text>

          <Input className="my-4" variant="secondary">
            <Mail color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="E-mail"
              onChangeText={setEmail}
              value={email}
            />
          </Input>

          <Input className="mb-4" variant="secondary">
            <Lock color={colors.zinc[400]} size={20} />

            <Input.Field
              secureTextEntry={!showPassword}
              placeholder="Senha"
              onChangeText={setPassword}
              value={password}
            />

            <Text
              onPress={() => setShowPassword((prev) => !prev)}
              className="ml-2"
            >
              {showPassword ? (
                <EyeOff color={colors.zinc[400]} size={20} />
              ) : (
                <Eye color={colors.zinc[400]} size={20} />
              )}
            </Text>
          </Input>

          <Button className="w-full" onPress={handleSignIn} isLoading={loading}>
            <Plane color={colors.lime[950]} size={20} />
            <Button.Title disabled>Entrar</Button.Title>
          </Button>
        </View>

        <View className="flex-row mb-10">
          <Text className="text-zinc-400">Não tem uma conta ainda? </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/sign-up")}
          >
            <Text className="text-lime-300 font-semibold">Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
