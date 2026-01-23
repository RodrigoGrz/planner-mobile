import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { registerServer } from "@/server/register-server";
import { colors } from "@/styles/colors";
import { maskPhone } from "@/utils/make-phone";
import { router } from "expo-router";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Pencil,
  Phone,
  User,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Image, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleRegister() {
    try {
      setLoading(true);
      await registerServer.registerTraveler({
        email,
        name,
        password,
        phone,
      });
      Alert.alert("Criar conta", "Conta criada com sucesso");
      router.back();
    } catch (error: any) {
      Alert.alert("Criar conta", error?.message ?? "Erro ao registrar");
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
            Criar uma conta?
          </Text>

          <Text className="text-zinc-400 text-center text-lg my-5">
            Crie sua conta para planejar melhor suas viagens!
          </Text>

          <Input variant="secondary">
            <User color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="Nome"
              onChangeText={setName}
              value={name}
            />
          </Input>

          <Input className="my-4" variant="secondary">
            <Mail color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="E-mail"
              onChangeText={setEmail}
              value={email}
            />
          </Input>

          <Input variant="secondary">
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

          <Input className="my-4" variant="secondary">
            <Phone color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="Telefone"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(text) => setPhone(maskPhone(text))}
            />
          </Input>

          <Button
            onPress={handleRegister}
            className="w-full"
            isLoading={loading}
          >
            <Pencil color={colors.lime[950]} size={20} />
            <Button.Title>Registrar</Button.Title>
          </Button>
        </View>

        <View className="flex-row mb-10">
          <Text className="text-zinc-400">Já tem uma conta? </Text>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push("/sign-in")}
          >
            <Text className="text-lime-300 font-semibold">Entrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
