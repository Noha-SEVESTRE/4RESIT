<script setup lang="ts">
import { onMounted, ref } from "vue";
import {
  createRecipeComment,
  deleteRecipeComment,
  getRecipeComments,
  type RecipeComment
} from "../services/discussionService";

const props = defineProps<{
  recipeId: string;
}>();

const comments = ref<RecipeComment[]>([]);
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

async function loadComments() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getRecipeComments(token, props.recipeId);
    comments.value = response.comments;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de charger les commentaires";
  } finally {
    isLoading.value = false;
  }
}

async function submitComment() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  if (!content.value.trim()) {
    errorMessage.value = "Le commentaire ne peut pas être vide";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";

  try {
    await createRecipeComment(token, props.recipeId, content.value.trim());
    content.value = "";
    await loadComments();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'ajouter le commentaire";
  } finally {
    isSaving.value = false;
  }
}

async function removeComment(comment: RecipeComment) {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const confirmed = window.confirm("Supprimer ce commentaire ?");

  if (!confirmed) {
    return;
  }

  try {
    await deleteRecipeComment(token, props.recipeId, comment.id);
    await loadComments();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Impossible de supprimer le commentaire";
  }
}

onMounted(loadComments);
</script>

<template>
  <div class="comments-panel">
    <div class="comments-header">
      <strong>Commentaires</strong>

      <button type="button" @click="loadComments">
        Actualiser
      </button>
    </div>

    <form class="comment-form" @submit.prevent="submitComment">
      <input v-model="content" type="text" placeholder="Ajouter un commentaire">

      <button type="submit" :disabled="isSaving">
        {{ isSaving ? "Envoi..." : "Envoyer" }}
      </button>
    </form>

    <p v-if="errorMessage" class="comment-error">
      {{ errorMessage }}
    </p>

    <p v-if="isLoading" class="comment-info">
      Chargement des commentaires...
    </p>

    <p v-else-if="!comments.length" class="comment-info">
      Aucun commentaire.
    </p>

    <div v-else class="comment-list">
      <div v-for="comment in comments" :key="comment.id" class="comment-item">
        <div>
          <strong>{{ comment.author.displayName }}</strong>
          <span>{{ formatDate(comment.createdAt) }}</span>
          <p>{{ comment.content }}</p>
        </div>

        <button type="button" @click="removeComment(comment)">
          Supprimer
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.comments-panel {
  border-top: 1px solid #e5e7eb;
  padding-top: 14px;
  display: grid;
  gap: 12px;
}

.comments-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.comments-header button,
.comment-form button,
.comment-item button {
  border: 0;
  border-radius: 999px;
  padding: 8px 11px;
  font-weight: 800;
  cursor: pointer;
  background: #f3f4f6;
  color: #111827;
}

.comment-form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.comment-form input {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 10px 12px;
}

.comment-error {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

.comment-info {
  margin: 0;
  color: #6b7280;
  font-weight: 700;
}

.comment-list {
  display: grid;
  gap: 10px;
}

.comment-item {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
}

.comment-item div {
  display: grid;
  gap: 4px;
}

.comment-item span {
  color: #6b7280;
  font-size: 12px;
}

.comment-item p {
  margin: 0;
}
</style>