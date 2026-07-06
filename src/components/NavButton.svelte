<script lang="ts">
  export let button: {
    key: string;
    icon: string;
    label: string;
    action: (event?: MouseEvent) => void;
    hasSubmenu?: boolean;
  };
  export let deviceType: 'mobile' | 'desktop';

  let isPressed = false;

  function handleClick(event: MouseEvent) {
    if (button.hasSubmenu) {
      button.action(event);
    } else {
      button.action();
    }
  }

  function handleTouchStart() {
    isPressed = true;
  }

  function handleTouchEnd() {
    setTimeout(() => {
      isPressed = false;
    }, 150);
  }
</script>

<button
  class="nav-button {deviceType}"
  class:pressed={isPressed}
  style="
    --btn-color: var(--b3-theme-on-surface, inherit);
    --btn-active-color: var(--b3-theme-primary, #007aff);
  "
  title={deviceType === "desktop" ? button.label : undefined}
  on:click={handleClick}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
>
  <span class="icon" class:svg-icon={button.icon && button.icon.startsWith("#icon")}>
    {#if button.icon && button.icon.startsWith("#icon")}
      <svg><use xlink:href={button.icon}></use></svg>
    {:else}
      {button.icon}
    {/if}
  </span>
  <span class="label">{button.label}</span>
</button>

<style>
  .nav-button {
    -webkit-tap-highlight-color: transparent;
    outline: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    color: var(--btn-color);
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    font-family: inherit;
    position: relative;
  }

  .nav-button.mobile {
    background: transparent;
    border: none;
    font-size: 18px;
    padding: 6px 12px;
    gap: 2px;
    min-width: 50px;
    min-height: 50px;
    border-radius: 16px;
  }

  .nav-button.desktop {
    background: transparent;
    border: none;
    font-size: 12px;
    padding: 8px;
    gap: 2px;
    min-width: 36px;
    min-height: 36px;
    border-radius: 8px;
  }

  .nav-button:active, .nav-button.pressed {
    transform: scale(0.85);
  }

  .nav-button.mobile:active {
    color: var(--btn-active-color);
    background-color: var(--b3-theme-background-light, rgba(0, 122, 255, 0.1));
  }

  .nav-button.desktop:hover {
    background-color: var(--b3-theme-background-light, rgba(59, 130, 246, 0.12));
    color: var(--btn-active-color);
  }

  .icon {
    pointer-events: none;
  }
  
  .nav-button.mobile .icon {
    font-size: 20px;
    margin-bottom: 2px;
  }
  
  .nav-button.desktop .icon {
    font-size: 20px;
    margin-bottom: 0;
  }

  .nav-button.desktop .label {
    display: none;
  }

  .label {
    pointer-events: none;
    font-size: 10px;
    font-weight: 500;
  }

  .icon.svg-icon svg {
    width: 20px;
    height: 20px;
    fill: currentColor;
    display: block;
  }
</style>