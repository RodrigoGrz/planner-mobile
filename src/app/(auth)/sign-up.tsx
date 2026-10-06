import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { useToast } from "@/contexts/ToastContext";
import { registerServer } from "@/server/register-server";
import { colors } from "@/styles/colors";
import { ERROR_MESSAGES } from "@/utils/error-messages";
import { maskPhone } from "@/utils/make-phone";
import {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  validateInput,
} from "@/utils/validateInput";
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
import { Image, Text, TouchableOpacity, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

export default function SignUp() {
  const { showError, showErrorMessage, showSuccess } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function getFormError() {
    if (!validateInput.personName(name)) {
      return ERROR_MESSAGES.invalidName;
    }

    if (!validateInput.email(email)) {
      return ERROR_MESSAGES.invalidEmail;
    }

    if (!validateInput.password(password)) {
      return ERROR_MESSAGES.invalidPassword;
    }

    if (!validateInput.phone(phone)) {
      return ERROR_MESSAGES.invalidPhone;
    }

    return null;
  }

  async function handleRegister() {
    const formError = getFormError();

    if (formError) {
      showErrorMessage(formError);
      return;
    }

    try {
      setLoading(true);
      await registerServer.registerTraveler({
        email: validateInput.normalizeEmail(email),
        name: name.trim(),
        password,
        phone: phone.trim(),
      });
      showSuccess("Conta criada com sucesso!");
      router.back();
    } catch (error) {
      showError(error, "Não foi possível criar a conta.");
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
              maxLength={MAX_NAME_LENGTH}
            />
          </Input>

          <Input className="my-4" variant="secondary">
            <Mail color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="E-mail"
              onChangeText={setEmail}
              value={email}
              maxLength={MAX_EMAIL_LENGTH}
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
              testID="toggle-password"
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
              maxLength={MAX_PHONE_LENGTH}
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
