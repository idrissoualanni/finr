<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;

class AuthController extends Controller
{
    /**
     * POST /api/auth/register
     */
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'     => 'required|string|max:100',
            'email'    => 'required|email|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'role'     => 'required|in:researcher,engineer',
        ]);

        $user = User::create([
            'name'     => $data['name'],
            'email'    => $data['email'],
            'password' => Hash::make($data['password']),
            'role'     => $data['role'],
        ]);

        $token = JWTAuth::fromUser($user);

        return response()->json([
            'user'  => $this->userResource($user),
            'token' => $token,
        ], 201);
    }

    /**
     * POST /api/auth/login
     */
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        if (!$token = JWTAuth::attempt($credentials)) {
            return response()->json(['message' => 'Identifiants incorrects.'], 401);
        }

        return response()->json([
            'user'  => $this->userResource(auth()->user()),
            'token' => $token,
        ]);
    }

    /**
     * POST /api/auth/logout
     */
    public function logout(): JsonResponse
    {
        JWTAuth::invalidate(JWTAuth::getToken());
        return response()->json(['message' => 'Déconnecté.']);
    }

    /**
     * POST /api/auth/refresh
     */
    public function refresh(): JsonResponse
    {
        try {
            $token = JWTAuth::refresh(JWTAuth::getToken());
            return response()->json(['token' => $token]);
        } catch (JWTException $e) {
            return response()->json(['message' => 'Token invalide.'], 401);
        }
    }

    /**
     * GET /api/auth/me
     */
    public function me(): JsonResponse
    {
        return response()->json($this->userResource(auth()->user()));
    }

    /**
     * GET /api/me/current-session
     * Retourne la session active la plus récente de l'ingénieur connecté.
     * Utilisé pour rediriger l'ingénieur vers SON espace de travail après login.
     *
     * Contrat : toujours 200. L'absence de session est un ETAT NORMAL (un
     * ingénieur attend qu'un chercheur lui en assigne une), pas une ressource
     * absente. Un 404 ici faisait echouer la requete dans la console du
     * navigateur et confondait trois situations tres differentes : profil
     * manquant, aucune session assignee, et vraie panne.
     *
     * @return JsonResponse {"id": int|null, "reason": string|null}
     */
    public function currentSession(): JsonResponse
    {
        $user = auth()->user();

        if (!$user->isEngineer()) {
            return response()->json(['id' => null, 'reason' => 'not_an_engineer']);
        }

        if (!$user->engineer) {
            return response()->json(['id' => null, 'reason' => 'no_profile']);
        }

        $session = $user->engineer->sessions()
            ->whereIn('status', ['draft', 'active', 'paused'])
            ->latest()
            ->first();

        if (!$session) {
            return response()->json(['id' => null, 'reason' => 'no_session']);
        }

        return response()->json(['id' => $session->id, 'reason' => null]);
    }

    private function userResource(User $user): array
    {
        return [
            'id'    => $user->id,
            'name'  => $user->name,
            'email' => $user->email,
            'role'  => $user->role,
        ];
    }
}

