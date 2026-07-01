import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { Modal } from "@/components/modal";
import { SyncingLabel } from "@/components/syncing-label";
import { Participant, ParticipantProps } from "@/components/participant";
import { TripLink, TripLinkProps } from "@/components/tripLink";
import { useNetwork } from "@/contexts/NetworkContext";
import { useTripDetails } from "@/hooks/useTripDetails";
import { linksServer } from "@/server/links-server";
import { colors } from "@/styles/colors";
import { validateInput } from "@/utils/validateInput";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";

interface DetailsProps {
  tripId: string;
}

export function Details({ tripId }: DetailsProps) {
  const { isOnline } = useNetwork();
  const { links, participants, status, refresh } = useTripDetails(tripId);

  const [showNewLinkModal, setShowNewLinkModal] = useState(false);
  const [isCreatingLinkTrip, setIsCreatingLinkTrip] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkURL, setLinkURL] = useState("");

  function resetNewLinkFields() {
    setLinkTitle("");
    setLinkURL("");
  }

  async function handleCreateTripLink() {
    if (!isOnline) {
      return Alert.alert(
        "Sem conexão",
        "Cadastrar links requer conexão com a internet.",
      );
    }

    try {
      if (!linkTitle.trim()) {
        return Alert.alert("Link", "Informe um título para o link");
      }

      if (!validateInput.url(linkURL.trim())) {
        return Alert.alert("Link", "Link inválido!");
      }

      setIsCreatingLinkTrip(true);

      await linksServer.create({
        tripId,
        title: linkTitle,
        url: linkURL,
      });

      Alert.alert("Link", "Link criado com sucesso!");

      resetNewLinkFields();

      await refresh();

      setShowNewLinkModal(false);
    } catch (error) {
      console.log(error);
    } finally {
      setIsCreatingLinkTrip(false);
    }
  }

  return (
    <View className="flex-1 mt-10">
      <Text className="text-zinc-50 text-2xl font-semibold mb-2">
        Links importantes
      </Text>
      <SyncingLabel visible={status === "syncing"} />

      <View className="flex-1">
        {status === "error" && links.length === 0 ? (
          <Text className="text-zinc-400 font-regular text-base mt-2 mb-6">
            Não foi possível carregar os links. Verifique sua conexão.
          </Text>
        ) : links.length > 0 ? (
          <FlatList
            data={links}
            keyExtractor={(item) => item.id}
            renderItem={({ item }: { item: TripLinkProps }) => (
              <TripLink data={item} />
            )}
            contentContainerClassName="gap-4"
          />
        ) : (
          <Text className="text-zinc-400 font-regular text-base mt-2 mb-6">
            Nenhum link adicionado.
          </Text>
        )}

        <Button
          variant="secondary"
          disabled={!isOnline}
          onPress={() => {
            if (!isOnline) {
              return Alert.alert(
                "Sem conexão",
                "Cadastrar links requer conexão com a internet.",
              );
            }
            setShowNewLinkModal(true);
          }}
        >
          <Plus color={colors.zinc[200]} size={20} />
          <Button.Title>Cadastrar novo link</Button.Title>
        </Button>
      </View>

      <View className="flex-1 border-t border-zinc-800 mt-6">
        <Text className="text-zinc-50 text-2xl font-semibold my-6">
          Convidados
        </Text>

        <FlatList
          data={participants}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: { item: ParticipantProps }) => (
            <Participant data={item} />
          )}
          contentContainerClassName="gap-4 pb-44"
        />
      </View>

      <Modal
        title="Cadastrar link"
        subtitle="Todos os convidados podem visualizar os links importantes."
        visible={showNewLinkModal}
        onClose={() => setShowNewLinkModal(false)}
      >
        <View className="gap-2 mb-3">
          <Input variant="secondary">
            <Input.Field
              placeholder="Título do link"
              onChangeText={setLinkTitle}
            />
          </Input>

          <Input variant="secondary">
            <Input.Field placeholder="URL" onChangeText={setLinkURL} />
          </Input>
        </View>

        <Button isLoading={isCreatingLinkTrip} onPress={handleCreateTripLink}>
          <Button.Title>Salvar Link</Button.Title>
        </Button>
      </Modal>
    </View>
  );
}
