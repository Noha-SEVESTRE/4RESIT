<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { createRecipe, updateRecipe, type Recipe } from "../services/recipeService";

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

function getStoredToken() {
  return (
      localStorage.getItem("token") ??
      localStorage.getItem("authToken") ??
      localStorage.getItem("supmealToken") ??
      localStorage.getItem("supmeal_token") ??
      ""
  );
}

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
    errorMessage.value = error instanceof Error ? error.message : "Impossible d'enregistrer la recette";
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
      </div>

      <button class="secondary-button" type="button" @click="emit('cancelled')">
        Fermer
      </button>
    </div>

    <form class="recipe-form" @submit.prevent="submitRecipe">
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

      <div class="image-picker-block">
        <div class="image-picker-header">
          <div>
            <strong>Image</strong>
            <span>Choisir une image</span>
          </div>

          <div class="image-picker-actions">
            <input
                ref="imageInput"
                type="file"
                accept="image/*"
                class="hidden-file-input"
                @change="handleImageChange"
            >

            <button class="secondary-button" type="button" @click="openImagePicker">
              Choisir une image
            </button>

            <button v-if="imageUrl" class="danger-button" type="button" @click="removeImage">
              Retirer
            </button>
          </div>
        </div>

        <p v-if="imageError" class="recipe-error">
          {{ imageError }}
        </p>

        <img v-if="imageUrl" class="recipe-image-preview" :src="imageUrl" alt="Aperçu de la recette">
      </div>

      <label>
        Source
        <input v-model="source" type="text" placeholder="Création personnelle ou URL">
      </label>

      <div class="structured-section">
        <div class="structured-header">
          <h3>Ingrédients</h3>

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
      </div>

      <label>
        Étapes
        <textarea v-model="stepsText" placeholder="Une étape par ligne"></textarea>
      </label>

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
        Tags
        <input v-model="tagsText" type="text" placeholder="rapide, midi, épicé">
      </label>

      <p v-if="errorMessage" class="recipe-error">
        {{ errorMessage }}
      </p>

      <button type="submit" :disabled="isLoading">
        {{ isLoading ? "Enregistrement..." : isEditMode ? "Enregistrer les modifications" : "Créer la recette" }}
      </button>
    </form>
  </section>
</template>

<style scoped>
.recipe-form-card {
  background: white;
  border-radius: 28px;
  padding: 28px;
  box-shadow: 0 20px 60px rgba(44, 32, 24, 0.08);
  display: grid;
  gap: 22px;
}

.recipe-form-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.section-label {
  margin: 0 0 4px;
  color: #f97316;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
}

.recipe-form-header h2 {
  margin: 0;
}

.recipe-form {
  display: grid;
  gap: 16px;
}

.recipe-form label {
  display: grid;
  gap: 8px;
  font-weight: 800;
}

.recipe-form input,
.recipe-form textarea {
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 13px 15px;
  font: inherit;
}

.recipe-form textarea {
  min-height: 90px;
  resize: vertical;
}

.recipe-form-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.recipe-form button,
.secondary-button {
  border: 0;
  border-radius: 16px;
  padding: 14px 18px;
  font-weight: 900;
  cursor: pointer;
  background: #f97316;
  color: white;
}

.secondary-button,
.recipe-form .secondary-button {
  background: #f3f4f6;
  color: #111827;
}

.recipe-form .danger-button {
  background: #fff1f2;
  color: #be123c;
}

.image-picker-block {
  display: grid;
  gap: 12px;
}

.image-picker-header {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: center;
}

.image-picker-header div {
  display: grid;
  gap: 4px;
}

.image-picker-header span {
  color: #6b7280;
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

.recipe-image-preview {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  border-radius: 18px;
  border: 1px solid #e5e7eb;
}

.structured-section {
  display: grid;
  gap: 12px;
}

.structured-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.structured-header h3 {
  margin: 0;
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
  background: #fff7f7;
  color: #b91c1c;
  font-weight: 700;
}

@media (max-width: 900px) {
  .recipe-form-row,
  .ingredient-row {
    grid-template-columns: 1fr;
  }

  .recipe-form-header,
  .structured-header,
  .image-picker-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>