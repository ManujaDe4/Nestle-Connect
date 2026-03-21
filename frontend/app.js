const API_BASE = "http://https://nestle-connect.onrender.com:5000/api";

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}