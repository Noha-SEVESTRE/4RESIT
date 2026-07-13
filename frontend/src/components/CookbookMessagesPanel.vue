<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  createCookbookMessage,
  deleteCookbookMessage,
  getCookbookMessages,
  type CookbookMessage
} from "../services/discussionService";

const props = defineProps<{
  cookbookId: string;
}>();

const messages = ref<CookbookMessage[]>([]);
const content = ref("");
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR");
}

async function loadMessages() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getCookbookMessages(token, props.cookbookId);
    messages.value = response.messages;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les messages";
  } finally {
    isLoading.value = false;
  }
}

async function submitMessage() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!content.value.trim()) {
    errorMessage.value = "Le message ne peut pas être vide";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await createCookbookMessage(token, props.cookbookId, content.value.trim());
    content.value = "";
    await loadMessages();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'envoyer le message";
  } finally {
    isSaving.value = false;
  }
}

async function removeMessage(message: CookbookMessage) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const confirmed = window.confirm("Supprimer ce message ?");

  if (!confirmed) {
    return;
  }

  try {
    await deleteCookbookMessage(token, props.cookbookId, message.id);
    await loadMessages();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de supprimer le message";
  }
}

watch(
    () => props.cookbookId,
    () => {
      loadMessages();
    }
);

onMounted(loadMessages);
</script>

<template>
  <div class="messages-panel">
    <div class="messages-header">
      <h5>Messages du cookbook</h5>

      <button type="button" @click="loadMessages">
        Actualiser
      </button>
    </div>

    <form class="message-form" @submit.prevent="submitMessage">
      <input v-model="content" type="text" placeholder="Écrire un message">

      <button type="submit" :disabled="isSaving">
        {{ isSaving ? "Envoi..." : "Envoyer" }}
      </button>
    </form>

    <p v-if="errorMessage" class="message-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="message-info">
      Chargement des messages...
    </p>

    <p v-else-if="!messages.length" class="message-info">
      Aucun message dans ce cookbook.
    </p>

    <div v-else class="message-list">
      <div v-for="message in messages" :key="message.id" class="message-item">
        <div>
          <strong>{{ message.author.displayName }}</strong>
          <span>{{ formatDate(message.createdAt) }}</span>
          <p>{{ message.content }}</p>
        </div>

        <button type="button" @click="removeMessage(message)">
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-panel {
  display: grid;
  gap: 12px;
}

.messages-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.messages-header h5 {
  margin: 0;
}

.messages-header button,
.message-form button,
.message-item button {
  border: 0;
  border-radius: 999px;
  padding: 8px 11px;
  font-weight: 800;
  cursor: pointer;
  background: #f3f4f6;
  color: #111827;
}

.message-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.message-form input {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 10px 12px;
}

.message-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

.message-info {
  margin: 0;
  color: #6b7280;
  font-weight: 700;
}

.message-list {
  display: grid;
  gap: 10px;
}

.message-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
}

.message-item div {
  display: grid;
  gap: 4px;
}

.message-item span {
  color: #6b7280;
  font-size: 12px;
}

.message-item p {
  margin: 0;
}
</style>