from connector.auth import assinar, verificar


def test_vetor_compativel_com_o_app():
    # Mesmo vetor de src/lib/crypto.test.ts (Node).
    sig = assinar("tok", "GET", "/trades?since=2026-01-01", b"", 1_700_000_000)
    assert sig == "11fabe36265616c1bcb6dfd9284bab9715ab977e3e1d269de1180399bc47f826"


def test_verificar_janela_e_corpo():
    ts = 1_700_000_000
    sig = assinar("tok", "POST", "/subscribe", b'{"a":1}', ts)
    assert verificar("tok", "POST", "/subscribe", b'{"a":1}', ts, sig, agora=ts + 10) == (True, "ok")
    assert verificar("tok", "POST", "/subscribe", b'{"a":1}', ts, sig, agora=ts + 301)[0] is False
    assert verificar("outro", "POST", "/subscribe", b'{"a":1}', ts, sig, agora=ts)[0] is False
    assert verificar("tok", "POST", "/subscribe", b'{"a":2}', ts, sig, agora=ts)[0] is False
    assert verificar("tok", "POST", "/subscribe", b'{"a":1}', None, sig, agora=ts)[0] is False
    assert verificar("tok", "POST", "/subscribe", b'{"a":1}', "x", sig, agora=ts)[0] is False
