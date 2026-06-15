"""
AES-256-CBC encryption helper. This is the EXACT same scheme as
src/lib/encryption.ts in the mobile app so a session encrypted on
the worker can be decrypted on the phone (and vice versa).

Scheme:
  passphrase  ->  SHA-256 ->  first 16 bytes = key, last 16 bytes = IV
  plaintext   ->  AES-256-CBC + PKCS7
  output      ->  base64
"""
import base64
import hashlib

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes


def _key_iv(passphrase: str) -> tuple[bytes, bytes]:
    digest = hashlib.sha256(passphrase.encode("utf-8")).digest()
    return digest[:16], digest[16:]


def encrypt(plaintext: str, passphrase: str) -> str:
    key, iv = _key_iv(passphrase)
    padder = padding.PKCS7(128).padder()
    padded = padder.update(plaintext.encode("utf-8")) + padder.finalize()
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    ct = encryptor.update(padded) + encryptor.finalize()
    return base64.b64encode(ct).decode("ascii")


def decrypt(ciphertext_b64: str, passphrase: str) -> str:
    key, iv = _key_iv(passphrase)
    ct = base64.b64decode(ciphertext_b64.encode("ascii"))
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    decryptor = cipher.decryptor()
    padded = decryptor.update(ct) + decryptor.finalize()
    unpadder = padding.PKCS7(128).unpadder()
    raw = unpadder.update(padded) + unpadder.finalize()
    return raw.decode("utf-8")
