const API_BASE = "https://nestle-connect.onrender.com";

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}