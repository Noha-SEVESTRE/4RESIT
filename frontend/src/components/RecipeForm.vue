<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { createRecipe, updateRecipe, type Recipe } from "../services/recipeService";
import { getStoredToken } from "../utils/authToken";
import {getErrorMessage} from "../utils/error.ts";

const props = defineProps<{
  recipe?: Recipe | null;
}>();

const emit = defineEmits<{
  saved: [];
  cancelled: [];
}>();

type IngredientFormRow = {
  name: string;
  quantity: string;
  unit: string;
};

const title = ref("");
const description = ref("");
const preparationTime = ref(10);
const cookingTime = ref(15);
const portions = ref(2);
const imageUrl = ref("");
const imageInput = ref<HTMLInputElement | null>(null);
const imageError = ref("");
const source = ref("Création personnelle");
const ingredients = ref<IngredientFormRow[]>([
  {
    name: "",
    quantity: "",
    unit: ""
  }
]);
const stepsText = ref("");
const tagsText = ref("");
const cuisineType = ref("");
const dietType = ref("");
const difficulty = ref("");
const isLoading = ref(false);
const errorMessage = ref("");

const isEditMode = computed(() => Boolean(props.recipe));

function getTagValue(prefix: string, tags?: string[]) {
  const tag = tags?.find((item) => item.toLowerCase().startsWith(prefix.toLowerCase()));

  return tag?.replace(prefix, "").trim() ?? "";
}

function getFreeTags(tags?: string[]) {
  return tags
      ?.filter((tag) => !tag.toLowerCase().startsWith("cuisine:"))
      .filter((tag) => !tag.toLowerCase().startsWith("régime:"))
      .filter((tag) => !tag.toLowerCase().startsWith("difficulté:"))
      .join(", ") ?? "";
}

function fillForm(recipe?: Recipe | null) {
  title.value = recipe?.title ?? "";
  description.value = recipe?.description ?? "";
  preparationTime.value = recipe?.preparationTime ?? 10;
  cookingTime.value = recipe?.cookingTime ?? 15;
  portions.value = recipe?.portions ?? 2;
  imageUrl.value = recipe?.imageUrl ?? "";
  imageError.value = "";
  source.value = recipe?.source ?? "Création personnelle";

  ingredients.value = recipe?.ingredients?.length
      ? recipe.ingredients.map((ingredient) => ({
        name: ingredient.name,
        quantity: ingredient.quantity ?? "",
        unit: ingredient.unit ?? ""
      }))
      : [
        {
          name: "",
          quantity: "",
          unit: ""
        }
      ];

  stepsText.value = recipe?.steps?.map((step) => step.instruction).join("\n") ?? "";
  cuisineType.value = getTagValue("cuisine:", recipe?.tags);
  dietType.value = getTagValue("régime:", recipe?.tags);
  difficulty.value = getTagValue("difficulté:", recipe?.tags);
  tagsText.value = getFreeTags(recipe?.tags);
}

function openImagePicker() {
  imageInput.value?.click();
}

function removeImage() {
  imageUrl.value = "";
  imageError.value = "";
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Image invalide"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Impossible de lire l'image"));
    };

    reader.readAsDataURL(file);
  });
}

async function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) {
    return;
  }

  imageError.value = "";

  if (!file.type.startsWith("image/")) {
    imageError.value = "Le fichier choisi doit être une image";
    input.value = "";
    return;
  }

  if (file.size > 1500000) {
    imageError.value = "L'image ne doit pas dépasser 1,5 Mo";
    input.value = "";
    return;
  }

  try {
    imageUrl.value = await readImageAsDataUrl(file);
  } catch (error) {
    imageError.value = error instanceof Error ? error.message : "Impossible de charger l'image";
  } finally {
    input.value = "";
  }
}

function addIngredientRow() {
  ingredients.value.push({
    name: "",
    quantity: "",
    unit: ""
  });
}

function removeIngredientRow(index: number) {
  if (ingredients.value.length === 1) {
    ingredients.value = [
      {
        name: "",
        quantity: "",
        unit: ""
      }
    ];
    return;
  }

  ingredients.value.splice(index, 1);
}

function parseIngredients() {
  return ingredients.value
      .map((ingredient) => ({
        name: ingredient.name.trim(),
        quantity: ingredient.quantity.trim(),
        unit: ingredient.unit.trim()
      }))
      .filter((ingredient) => ingredient.name);
}

function parseSteps() {
  return stepsText.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
}

function parseTags() {
  const freeTags = tagsText.value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const structuredTags = [
    cuisineType.value.trim() ? `cuisine: ${cuisineType.value.trim()}` : "",
    dietType.value.trim() ? `régime: ${dietType.value.trim()}` : "",
    difficulty.value.trim() ? `difficulté: ${difficulty.value.trim()}` : ""
  ].filter(Boolean);

  return [...freeTags, ...structuredTags];
}

async function submitRecipe() {
  const token = getStoredToken();

  if (!token) {
    errorMessage.value = "Session introuvable, reconnecte-toi";
    return;
  }

  const parsedIngredients = parseIngredients();
  const steps = parseSteps();

  if (!title.value.trim()) {
    errorMessage.value = "Le titre est obligatoire";
    return;
  }

  if (!parsedIngredients.length) {
    errorMessage.value = "Ajoute au moins un ingrédient";
    return;
  }

  if (!steps.length) {
    errorMessage.value = "Ajoute au moins une étape";
    return;
  }

  isLoading.value = true;
  errorMessage.value = "";

  try {
    const payload = {
      title: title.value.trim(),
      description: description.value.trim(),
      preparationTime: Number(preparationTime.value),
      cookingTime: Number(cookingTime.value),
      portions: Number(portions.value),
      imageUrl: imageUrl.value.trim(),
      source: source.value.trim(),
      ingredients: parsedIngredients,
      steps,
      tags: parseTags()
    };

    if (props.recipe) {
      await updateRecipe(token, props.recipe.id, payload);
    } else {
      await createRecipe(token, payload);
    }

    emit("saved");
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "Impossible d'enregistrer la recette")
  } finally {
    isLoading.value = false;
  }
}

watch(
    () => props.recipe,
    (recipe) => {
      fillForm(recipe);
    },
    { immediate: true }
);
</script>

<template>
  <section class="recipe-form-card">
    <div class="recipe-form-header">
      <div>
        <p class="section-label">{{ isEditMode ? "Modification" : "Nouvelle recette" }}</p>
        <h2>{{ isEditMode ? "Modifier la recette" : "Ajouter une recette" }}</h2>
        <p>
          Renseignez les informations principales, les ingrédients, les étapes et les tags.
        </p>
      </div>

      <button class="secondary-button" type="button" @click="emit('cancelled')">
        Fermer
      </button>
    </div>

    <form class="recipe-form" @submit.prevent="submitRecipe">
      <section class="form-section">
        <div class="form-section-header">
          <div>
            <h3>Informations générales</h3>
            <p>Titre, description, temps et portions de la recette.</p>
          </div>
        </div>

        <label>
          Titre
          <input v-model="title" type="text" placeholder="Ex : Poulet citron et riz">
        </label>

        <label>
          Description
          <textarea v-model="description" placeholder="Petite description de la recette"></textarea>
        </label>

        <div class="recipe-form-row">
          <label>
            Préparation
            <input v-model="preparationTime" type="number" min="0">
          </label>

          <label>
            Cuisson
            <input v-model="cookingTime" type="number" min="0">
          </label>

          <label>
            Portions
            <input v-model="portions" type="number" min="1">
          </label>
        </div>
      </section>

      <section class="form-section form-section-split">
        <div class="image-picker-block">
          <div class="form-section-header">
            <div>
              <h3>Image</h3>
              <p>Ajoutez une image optionnelle pour illustrer la recette.</p>
            </div>
          </div>

          <input
              ref="imageInput"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleImageChange"
          >

          <div class="image-preview-zone">
            <img v-if="imageUrl" class="recipe-image-preview" :src="imageUrl" alt="Aperçu de la recette">

            <div v-else class="image-empty-state">
              <span>Image optionnelle</span>
              <p>Aucune image sélectionnée.</p>
            </div>
          </div>

          <div class="image-picker-actions">
            <button class="secondary-button" type="button" @click="openImagePicker">
              Choisir une image
            </button>

            <button v-if="imageUrl" class="danger-button" type="button" @click="removeImage">
              Retirer
            </button>
          </div>

          <p v-if="imageError" class="recipe-error">
            {{ imageError }}
          </p>
        </div>

          <label>
            Source
            <input v-model="source" type="text" placeholder="Création personnelle ou URL">
          </label>
      </section>

      <section class="form-section">
        <div class="structured-header">
          <div>
            <h3>Ingrédients</h3>
            <p>Ajoutez au moins un ingrédient.</p>
          </div>

          <button class="secondary-button" type="button" @click="addIngredientRow">
            Ajouter un ingrédient
          </button>
        </div>

        <div class="ingredient-grid">
          <div v-for="(ingredient, index) in ingredients" :key="index" class="ingredient-row">
            <input v-model="ingredient.name" type="text" placeholder="Ingrédient">
            <input v-model="ingredient.quantity" type="text" placeholder="Quantité">
            <input v-model="ingredient.unit" type="text" placeholder="Unité">

            <button class="danger-button" type="button" @click="removeIngredientRow(index)">
              Retirer
            </button>
          </div>
        </div>
      </section>

      <section class="form-section">
        <div class="form-section-header">
          <div>
            <h3>Étapes</h3>
            <p>Écrivez une étape par ligne.</p>
          </div>
        </div>

        <label>
          Instructions
          <textarea v-model="stepsText" class="steps-textarea" placeholder="Une étape par ligne"></textarea>
        </label>
      </section>

      <section class="form-section">
        <div class="form-section-header">
          <div>
            <h3>Tags et catégories</h3>
            <p>Ajoutez des tags et une catégorie pour votre recette.</p>
          </div>
        </div>

        <div class="recipe-form-row">
          <label>
            Type de cuisine
            <input v-model="cuisineType" type="text" placeholder="Ex : française, italienne">
          </label>

          <label>
            Régime
            <input v-model="dietType" type="text" placeholder="Ex : végétarien, protéiné">
          </label>

          <label>
            Difficulté
            <input v-model="difficulty" type="text" placeholder="Ex : facile, moyen">
          </label>
        </div>

        <label>
          Tags libres
          <input v-model="tagsText" type="text" placeholder="rapide, midi, épicé">
        </label>
      </section>

      <p v-if="errorMessage" class="recipe-error">
        {{ errorMessage }}
      </p>

      <div class="form-footer">
        <button class="secondary-button" type="button" @click="emit('cancelled')">
          Annuler
        </button>

        <button type="submit" :disabled="isLoading">
          {{ isLoading ? "Enregistrement..." : isEditMode ? "Enregistrer les modifications" : "Créer la recette" }}
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.recipe-form-card {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  background: #fffdf8;
  border: 1px solid #decab0;
  border-radius: 28px;
  padding: 26px;
  box-shadow: 0 20px 60px rgba(44, 32, 24, 0.1);
  display: grid;
  gap: 22px;
}

.recipe-form-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  padding-bottom: 18px;
  border-bottom: 1px solid #eadbc8;
}

.recipe-form-header h2 {
  margin: 0 0 8px;
}

.recipe-form-header p {
  margin: 0;
  color: #6b5f55;
  line-height: 1.5;
}

.section-label {
  margin: 0 0 4px;
  color: #ea580c;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 12px;
}

.recipe-form {
  display: grid;
  gap: 18px;
}

.form-section {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid #e2d2bd;
  border-radius: 22px;
  background: #fffaf2;
}

.form-section-split {
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  align-items: start;
}

.form-section-header h3,
.structured-header h3 {
  margin: 0 0 4px;
  font-size: 20px;
}

.form-section-header p,
.structured-header p {
  margin: 0;
  color: #6b5f55;
  font-size: 14px;
  line-height: 1.5;
}

.recipe-form label {
  display: grid;
  gap: 8px;
  color: #2f241d;
  font-weight: 900;
}

.recipe-form input,
.recipe-form textarea {
  border: 1px solid #d9c7b2;
  border-radius: 15px;
  padding: 12px 14px;
  background: #fffdf8;
  color: #2f241d;
  font: inherit;
}

.recipe-form input:focus,
.recipe-form textarea:focus {
  outline: none;
  border-color: #d97706;
  box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.13);
}

.recipe-form textarea {
  min-height: 90px;
  resize: vertical;
}

.steps-textarea {
  min-height: 150px;
}

.recipe-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.recipe-form button,
.secondary-button {
  border: 0;
  border-radius: 15px;
  padding: 12px 16px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button,
.recipe-form .secondary-button {
  background: #f2ebe3;
  color: #2f241d;
  box-shadow: none;
}

.recipe-form .danger-button {
  background: #fff1f2;
  color: #be123c;
  box-shadow: none;
}

.image-picker-block {
  display: grid;
  gap: 14px;
}

.image-preview-zone {
  min-height: 190px;
  border: 1px dashed #d9c7b2;
  border-radius: 18px;
  overflow: hidden;
  background: #f8efe4;
}

.recipe-image-preview {
  width: 100%;
  height: 220px;
  object-fit: cover;
  display: block;
}

.image-empty-state {
  min-height: 190px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  color: #7b6d62;
}

.image-empty-state span {
  color: #3b2d24;
  font-weight: 900;
}

.image-empty-state p {
  margin: 0;
  font-size: 14px;
}

.image-picker-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.hidden-file-input {
  display: none;
}

.structured-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
}

.ingredient-grid {
  display: grid;
  gap: 10px;
}

.ingredient-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 10px;
}

.recipe-error {
  margin: 0;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #991b1b;
  font-weight: 800;
}

.form-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 4px;
}

@media (max-width: 1100px) {
  .form-section-split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .recipe-form-card {
    padding: 20px;
  }

  .recipe-form-row,
  .ingredient-row {
    grid-template-columns: 1fr;
  }

  .recipe-form-header,
  .structured-header,
  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>