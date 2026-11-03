--
-- PostgreSQL database dump
--

\restrict aFznLxORbaGicI5gz3ArrN3fiyCe5afKmzwITcJIkkCiK2eYAW6Dbyc6IwuxL2f

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: sistema; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA sistema;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: atendimentos; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.atendimentos (
    id integer NOT NULL,
    identificador_paciente text NOT NULL,
    aluno_id integer NOT NULL,
    cidade_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: atendimentos_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.atendimentos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: atendimentos_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.atendimentos_id_seq OWNED BY sistema.atendimentos.id;


--
-- Name: auditoria; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.auditoria (
    id bigint NOT NULL,
    quando timestamp with time zone DEFAULT now() NOT NULL,
    ator_id integer,
    acao text NOT NULL,
    foto_id integer,
    atendimento_id integer,
    detalhe jsonb,
    ator_email text,
    ip text,
    user_agent text
);


--
-- Name: auditoria_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.auditoria_id_seq OWNED BY sistema.auditoria.id;


--
-- Name: aviso_destinos; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.aviso_destinos (
    aviso_id integer NOT NULL,
    user_id integer NOT NULL
);


--
-- Name: aviso_leituras; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.aviso_leituras (
    aviso_id integer NOT NULL,
    user_id integer NOT NULL,
    lido_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: avisos; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.avisos (
    id integer NOT NULL,
    titulo text NOT NULL,
    corpo text NOT NULL,
    para_todos boolean DEFAULT true NOT NULL,
    criado_por integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    editado_em timestamp with time zone
);


--
-- Name: avisos_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.avisos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: avisos_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.avisos_id_seq OWNED BY sistema.avisos.id;


--
-- Name: cidades; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.cidades (
    id integer NOT NULL,
    nome text NOT NULL,
    lat double precision,
    lng double precision
);


--
-- Name: cidades_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.cidades_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cidades_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.cidades_id_seq OWNED BY sistema.cidades.id;


--
-- Name: fotos; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.fotos (
    id integer NOT NULL,
    atendimento_id integer NOT NULL,
    storage_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    bytes integer DEFAULT 0 NOT NULL,
    thumb_key text,
    thumb_bytes integer DEFAULT 0 NOT NULL,
    width integer,
    height integer,
    oculta_em timestamp with time zone,
    oculta_por integer,
    dispositivo text,
    so text,
    navegador text
);


--
-- Name: fotos_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.fotos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fotos_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.fotos_id_seq OWNED BY sistema.fotos.id;


--
-- Name: pin_cadastro; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.pin_cadastro (
    email text NOT NULL,
    pin_hash text,
    expira timestamp with time zone,
    tentativas integer DEFAULT 0 NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    token_hash text,
    token_expira timestamp with time zone
);


--
-- Name: pin_email; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.pin_email (
    user_id integer NOT NULL,
    novo_email text NOT NULL,
    pin_hash text NOT NULL,
    expira timestamp with time zone NOT NULL,
    tentativas integer DEFAULT 0 NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pin_senha; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.pin_senha (
    user_id integer NOT NULL,
    pin_hash text,
    expira timestamp with time zone,
    tentativas integer DEFAULT 0 NOT NULL,
    enviado_em timestamp with time zone DEFAULT now() NOT NULL,
    reset_hash text,
    reset_expira timestamp with time zone
);


--
-- Name: push_subs; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.push_subs (
    id integer NOT NULL,
    user_id integer NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    ua text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: push_subs_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.push_subs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_subs_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.push_subs_id_seq OWNED BY sistema.push_subs.id;


--
-- Name: r2_uso; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.r2_uso (
    mes text NOT NULL,
    classe_a integer DEFAULT 0 NOT NULL,
    classe_b integer DEFAULT 0 NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.refresh_tokens (
    id bigint NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    familia text NOT NULL,
    cid integer,
    lembrar boolean DEFAULT false NOT NULL,
    expira timestamp with time zone NOT NULL,
    revogado boolean DEFAULT false NOT NULL,
    criado timestamp with time zone DEFAULT now() NOT NULL,
    ip text,
    ua text
);


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.refresh_tokens_id_seq OWNED BY sistema.refresh_tokens.id;


--
-- Name: users; Type: TABLE; Schema: sistema; Owner: -
--

CREATE TABLE sistema.users (
    id integer NOT NULL,
    nome text NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    matricula text,
    cidade_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    autorizado boolean DEFAULT true NOT NULL,
    origem text DEFAULT 'senha'::text NOT NULL,
    foto_url text,
    ultimo_acesso timestamp with time zone,
    foto_key text,
    foto_v integer DEFAULT 0 NOT NULL,
    google_email text,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['ADMIN'::text, 'ALUNO'::text])))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: sistema; Owner: -
--

CREATE SEQUENCE sistema.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: sistema; Owner: -
--

ALTER SEQUENCE sistema.users_id_seq OWNED BY sistema.users.id;


--
-- Name: atendimentos id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.atendimentos ALTER COLUMN id SET DEFAULT nextval('sistema.atendimentos_id_seq'::regclass);


--
-- Name: auditoria id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.auditoria ALTER COLUMN id SET DEFAULT nextval('sistema.auditoria_id_seq'::regclass);


--
-- Name: avisos id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.avisos ALTER COLUMN id SET DEFAULT nextval('sistema.avisos_id_seq'::regclass);


--
-- Name: cidades id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.cidades ALTER COLUMN id SET DEFAULT nextval('sistema.cidades_id_seq'::regclass);


--
-- Name: fotos id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.fotos ALTER COLUMN id SET DEFAULT nextval('sistema.fotos_id_seq'::regclass);


--
-- Name: push_subs id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.push_subs ALTER COLUMN id SET DEFAULT nextval('sistema.push_subs_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('sistema.refresh_tokens_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.users ALTER COLUMN id SET DEFAULT nextval('sistema.users_id_seq'::regclass);


--
-- Name: atendimentos atendimentos_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.atendimentos
    ADD CONSTRAINT atendimentos_pkey PRIMARY KEY (id);


--
-- Name: auditoria auditoria_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.auditoria
    ADD CONSTRAINT auditoria_pkey PRIMARY KEY (id);


--
-- Name: aviso_destinos aviso_destinos_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.aviso_destinos
    ADD CONSTRAINT aviso_destinos_pkey PRIMARY KEY (aviso_id, user_id);


--
-- Name: aviso_leituras aviso_leituras_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.aviso_leituras
    ADD CONSTRAINT aviso_leituras_pkey PRIMARY KEY (aviso_id, user_id);


--
-- Name: avisos avisos_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.avisos
    ADD CONSTRAINT avisos_pkey PRIMARY KEY (id);


--
-- Name: cidades cidades_nome_key; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.cidades
    ADD CONSTRAINT cidades_nome_key UNIQUE (nome);


--
-- Name: cidades cidades_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.cidades
    ADD CONSTRAINT cidades_pkey PRIMARY KEY (id);


--
-- Name: fotos fotos_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.fotos
    ADD CONSTRAINT fotos_pkey PRIMARY KEY (id);


--
-- Name: fotos fotos_storage_key_key; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.fotos
    ADD CONSTRAINT fotos_storage_key_key UNIQUE (storage_key);


--
-- Name: pin_cadastro pin_cadastro_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.pin_cadastro
    ADD CONSTRAINT pin_cadastro_pkey PRIMARY KEY (email);


--
-- Name: pin_email pin_email_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.pin_email
    ADD CONSTRAINT pin_email_pkey PRIMARY KEY (user_id);


--
-- Name: pin_senha pin_senha_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.pin_senha
    ADD CONSTRAINT pin_senha_pkey PRIMARY KEY (user_id);


--
-- Name: push_subs push_subs_endpoint_key; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.push_subs
    ADD CONSTRAINT push_subs_endpoint_key UNIQUE (endpoint);


--
-- Name: push_subs push_subs_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.push_subs
    ADD CONSTRAINT push_subs_pkey PRIMARY KEY (id);


--
-- Name: r2_uso r2_uso_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.r2_uso
    ADD CONSTRAINT r2_uso_pkey PRIMARY KEY (mes);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_key; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: atend_aluno_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX atend_aluno_idx ON sistema.atendimentos USING btree (aluno_id, created_at DESC);


--
-- Name: auditoria_acao_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX auditoria_acao_idx ON sistema.auditoria USING btree (acao, quando DESC);


--
-- Name: auditoria_ator_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX auditoria_ator_idx ON sistema.auditoria USING btree (ator_id, quando DESC);


--
-- Name: auditoria_quando_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX auditoria_quando_idx ON sistema.auditoria USING btree (quando DESC);


--
-- Name: avisos_created_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX avisos_created_idx ON sistema.avisos USING btree (created_at DESC);


--
-- Name: fotos_oculta_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX fotos_oculta_idx ON sistema.fotos USING btree (oculta_em) WHERE (oculta_em IS NOT NULL);


--
-- Name: push_subs_user_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX push_subs_user_idx ON sistema.push_subs USING btree (user_id);


--
-- Name: refresh_tokens_user_idx; Type: INDEX; Schema: sistema; Owner: -
--

CREATE INDEX refresh_tokens_user_idx ON sistema.refresh_tokens USING btree (user_id);


--
-- Name: users_email_uq; Type: INDEX; Schema: sistema; Owner: -
--

CREATE UNIQUE INDEX users_email_uq ON sistema.users USING btree (lower(email));


--
-- Name: users_matricula_uq; Type: INDEX; Schema: sistema; Owner: -
--

CREATE UNIQUE INDEX users_matricula_uq ON sistema.users USING btree (lower(matricula)) WHERE ((matricula IS NOT NULL) AND (matricula <> ''::text));


--
-- Name: atendimentos atendimentos_aluno_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.atendimentos
    ADD CONSTRAINT atendimentos_aluno_id_fkey FOREIGN KEY (aluno_id) REFERENCES sistema.users(id);


--
-- Name: atendimentos atendimentos_cidade_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.atendimentos
    ADD CONSTRAINT atendimentos_cidade_id_fkey FOREIGN KEY (cidade_id) REFERENCES sistema.cidades(id);


--
-- Name: aviso_destinos aviso_destinos_aviso_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.aviso_destinos
    ADD CONSTRAINT aviso_destinos_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES sistema.avisos(id) ON DELETE CASCADE;


--
-- Name: aviso_destinos aviso_destinos_user_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.aviso_destinos
    ADD CONSTRAINT aviso_destinos_user_id_fkey FOREIGN KEY (user_id) REFERENCES sistema.users(id) ON DELETE CASCADE;


--
-- Name: aviso_leituras aviso_leituras_aviso_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.aviso_leituras
    ADD CONSTRAINT aviso_leituras_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES sistema.avisos(id) ON DELETE CASCADE;


--
-- Name: aviso_leituras aviso_leituras_user_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.aviso_leituras
    ADD CONSTRAINT aviso_leituras_user_id_fkey FOREIGN KEY (user_id) REFERENCES sistema.users(id) ON DELETE CASCADE;


--
-- Name: avisos avisos_criado_por_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.avisos
    ADD CONSTRAINT avisos_criado_por_fkey FOREIGN KEY (criado_por) REFERENCES sistema.users(id) ON DELETE SET NULL;


--
-- Name: fotos fotos_atendimento_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.fotos
    ADD CONSTRAINT fotos_atendimento_id_fkey FOREIGN KEY (atendimento_id) REFERENCES sistema.atendimentos(id) ON DELETE CASCADE;


--
-- Name: pin_email pin_email_user_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.pin_email
    ADD CONSTRAINT pin_email_user_id_fkey FOREIGN KEY (user_id) REFERENCES sistema.users(id) ON DELETE CASCADE;


--
-- Name: pin_senha pin_senha_user_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.pin_senha
    ADD CONSTRAINT pin_senha_user_id_fkey FOREIGN KEY (user_id) REFERENCES sistema.users(id) ON DELETE CASCADE;


--
-- Name: push_subs push_subs_user_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.push_subs
    ADD CONSTRAINT push_subs_user_id_fkey FOREIGN KEY (user_id) REFERENCES sistema.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES sistema.users(id) ON DELETE CASCADE;


--
-- Name: users users_cidade_id_fkey; Type: FK CONSTRAINT; Schema: sistema; Owner: -
--

ALTER TABLE ONLY sistema.users
    ADD CONSTRAINT users_cidade_id_fkey FOREIGN KEY (cidade_id) REFERENCES sistema.cidades(id);


--
-- PostgreSQL database dump complete
--

\unrestrict aFznLxORbaGicI5gz3ArrN3fiyCe5afKmzwITcJIkkCiK2eYAW6Dbyc6IwuxL2f

