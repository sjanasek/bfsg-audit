<template>
  <nav>
    <span @click="toggle">Menü</span>
    <button :aria-label="label"></button>
    <img :src="logo" :alt="altText">
  </nav>
</template>
